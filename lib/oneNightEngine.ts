/**
 * 月夜換牌（一夜狼人類）- 多手機房間版規則引擎（只在房主手機上執行）
 * 發牌、夜晚同時行動、依序結算（強盜 → 搗蛋鬼 → 酒鬼 → 失眠者）、投票、勝負判定全部由這裡處理，
 * 每支手機只拿到自己有權看到的資訊（buildOneNightView）。
 *
 * 引擎沒有計時器，只被「操作」驅動：白天只記下 dayStartedAt，
 * 時間到後房主（或任何人）可以開始投票；夜晚／投票卡住時房主可以強制推進。
 */

import { addPeerPlayer, shuffle } from '@/lib/peerRoom';
import { oneNightBotAction } from '@/lib/bots/oneNightBot';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';
import {
  CENTER_COUNT,
  NONE,
  OneNightAction,
  OneNightConfig,
  OneNightHostRoom,
  OneNightIntel,
  OneNightNightView,
  OneNightOutcome,
  OneNightResultInfo,
  OneNightRole,
  OneNightRoomView,
  OneNightSeat,
  OneNightState,
  OneNightTask
} from '@/types/oneNightRoom';

export type OneNightMutation = PeerMutation<OneNightHostRoom>;

export const ONENIGHT_MIN_PLAYERS = 3;
export const ONENIGHT_MAX_PLAYERS = 10;
export const MAX_WOLVES = 3;

// ───────── 配置 ─────────

type RoleToggles = Pick<OneNightConfig, 'minion' | 'seer' | 'robber' | 'troublemaker' | 'drunk' | 'insomniac' | 'hunter'>;
type RoleSetup = RoleToggles & Pick<OneNightConfig, 'wolfCount'>;

export const TOGGLE_KEYS = ['minion', 'seer', 'robber', 'troublemaker', 'drunk', 'insomniac', 'hunter'] as const;
export const TOGGLE_ROLE: Record<(typeof TOGGLE_KEYS)[number], OneNightRole> = {
  minion: 'MINION',
  seer: 'SEER',
  robber: 'ROBBER',
  troublemaker: 'TROUBLEMAKER',
  drunk: 'DRUNK',
  insomniac: 'INSOMNIAC',
  hunter: 'HUNTER'
};

// 依人數的建議配置（牌庫 = 人數 + 3，缺的用村民補滿）
export function defaultSetup(playerCount: number): RoleSetup {
  const n = Math.min(Math.max(playerCount, ONENIGHT_MIN_PLAYERS), ONENIGHT_MAX_PLAYERS);
  const base = { minion: false, seer: true, robber: true, troublemaker: true, drunk: false, insomniac: false, hunter: false };
  if (n <= 4) return { wolfCount: 2, ...base };
  if (n === 5) return { wolfCount: 2, ...base, minion: true, drunk: true };
  if (n === 6) return { wolfCount: 2, ...base, minion: true, drunk: true, insomniac: true };
  if (n <= 8) return { wolfCount: 2, ...base, minion: true, drunk: true, insomniac: true, hunter: true };
  return { wolfCount: 3, ...base, minion: true, drunk: true, insomniac: true, hunter: true };
}

export function deckSize(playerCount: number): number {
  return playerCount + CENTER_COUNT;
}

// 牌庫摘要：每種角色的張數、村民補幾張、配置是否合法
export function deckSummary(config: OneNightConfig, playerCount: number) {
  const total = deckSize(playerCount);
  const counts: [OneNightRole, number][] = [['WOLF', config.wolfCount]];
  for (const k of TOGGLE_KEYS) if (config[k]) counts.push([TOGGLE_ROLE[k], 1]);
  const special = counts.reduce((sum, [, c]) => sum + c, 0);
  const villagers = total - special;
  const roles = counts.filter(([, c]) => c > 0);
  if (villagers > 0) roles.push(['VILLAGER', villagers]);
  return { total, special, villagers, roles, invalid: villagers < 0 || config.wolfCount < 1 };
}

export function buildDeck(config: OneNightConfig, playerCount: number): OneNightRole[] {
  const deck: OneNightRole[] = [];
  for (const [role, count] of deckSummary(config, playerCount).roles) {
    for (let i = 0; i < count; i++) deck.push(role);
  }
  return deck;
}

export function createInitialOneNightState(playerCount = 1, config?: OneNightConfig, notice: string | null = null): OneNightState {
  return {
    phase: 'LOBBY',
    config: config ?? { auto: true, ...defaultSetup(playerCount), dayMinutes: 5 },
    notice,
    seats: [],
    center: [],
    initialCenter: [],
    intel: {},
    robberTarget: null,
    tmPair: null,
    drunkIndex: null,
    events: [],
    guesses: [],
    dayStartedAt: 0,
    votes: {},
    outcome: null
  };
}

function sanitizeConfig(current: OneNightConfig, patch: Partial<OneNightConfig>, playerCount: number): OneNightConfig {
  const next = { ...current };
  if (patch.auto === true) {
    next.auto = true;
    Object.assign(next, defaultSetup(playerCount));
  }
  let manual = false;
  if (typeof patch.wolfCount === 'number') {
    next.wolfCount = Math.min(Math.max(1, Math.floor(patch.wolfCount)), MAX_WOLVES);
    manual = true;
  }
  for (const k of TOGGLE_KEYS) {
    if (typeof patch[k] === 'boolean') {
      next[k] = patch[k] as boolean;
      manual = true;
    }
  }
  if (manual && patch.auto !== true) next.auto = false;
  if (typeof patch.dayMinutes === 'number' && [0, 3, 5, 7].includes(patch.dayMinutes)) next.dayMinutes = patch.dayMinutes;
  return next;
}

// 配置跟著人數走（房主還沒手動調整時）
function syncAutoConfig(room: OneNightHostRoom) {
  const state = room.gameState;
  if ((state.phase === 'LOBBY' || state.phase === 'RESULT') && state.config.auto) Object.assign(state.config, defaultSetup(room.players.length));
}

// ───────── 小工具 ─────────

const seatOf = (state: OneNightState, id: string | null | undefined) =>
  id ? state.seats.find(s => s.playerId === id) : undefined;
const inGame = (state: OneNightState) => state.phase !== 'LOBBY' && state.phase !== 'RESULT';
const isWolfTeam = (role: OneNightRole) => role === 'WOLF' || role === 'MINION';

function addIntel(state: OneNightState, playerId: string, intel: OneNightIntel) {
  (state.intel[playerId] ||= []).push(intel);
}

function abortToLobby(room: OneNightHostRoom, notice: string) {
  room.gameState = createInitialOneNightState(room.players.length, room.gameState.config, notice);
  syncAutoConfig(room);
}

// 每個身分夜裡要做的事
export function taskOfSeat(state: OneNightState, seat: OneNightSeat): OneNightTask {
  switch (seat.initial) {
    case 'WOLF': return state.seats.filter(s => s.initial === 'WOLF').length > 1 ? 'WOLF_ACK' : 'WOLF_PEEK';
    case 'MINION': return 'MINION_ACK';
    case 'SEER': return 'SEER';
    case 'ROBBER': return 'ROBBER';
    case 'TROUBLEMAKER': return 'TROUBLEMAKER';
    case 'DRUNK': return 'DRUNK';
    case 'INSOMNIAC': return 'INSOMNIAC';
    default: return 'GUESS'; // 村民、獵人：夜間猜測
  }
}

// ───────── 流程 ─────────

function startGame(room: OneNightHostRoom): string | null {
  const state = room.gameState;
  const total = room.players.length;
  if (total < ONENIGHT_MIN_PLAYERS) return `至少需要 ${ONENIGHT_MIN_PLAYERS} 位玩家才能開始`;
  if (total > ONENIGHT_MAX_PLAYERS) return `最多 ${ONENIGHT_MAX_PLAYERS} 位玩家`;
  if (state.config.auto) Object.assign(state.config, defaultSetup(total));
  const summary = deckSummary(state.config, total);
  if (summary.invalid) return `角色太多了：${total} 人要用 ${summary.total} 張牌，目前選了 ${summary.special} 張特殊角色，請減少一些`;

  const dealt = shuffle(buildDeck(state.config, total));
  const config = state.config;
  Object.assign(state, createInitialOneNightState(total, config));
  state.seats = room.players.map((p, i) => ({ playerId: p.id, initial: dealt[i], current: dealt[i], ready: false, done: false }));
  state.initialCenter = dealt.slice(total, total + CENTER_COUNT);
  state.center = [...state.initialCenter];
  state.phase = 'REVEAL';
  return null;
}

function beginNight(state: OneNightState) {
  state.phase = 'NIGHT';
  state.intel = {};
  state.events = [];
  state.guesses = [];
  state.robberTarget = null;
  state.tmPair = null;
  state.drunkIndex = null;
  for (const s of state.seats) s.done = false;
  const wolfIds = state.seats.filter(s => s.initial === 'WOLF').map(s => s.playerId);
  for (const s of state.seats) {
    if (s.initial === 'WOLF') addIntel(state, s.playerId, { kind: 'WOLF_MATES', ids: wolfIds.filter(id => id !== s.playerId) });
    if (s.initial === 'MINION') addIntel(state, s.playerId, { kind: 'MINION_SEES', ids: wolfIds });
  }
}

function checkNightAdvance(state: OneNightState) {
  if (state.phase === 'NIGHT' && state.seats.every(s => s.done)) resolveNight(state);
}

function swapSeats(a: OneNightSeat, b: OneNightSeat) {
  const t = a.current;
  a.current = b.current;
  b.current = t;
}

// 結算順序固定：強盜 → 搗蛋鬼 → 酒鬼 → 失眠者
function resolveNight(state: OneNightState) {
  const robber = state.seats.find(s => s.initial === 'ROBBER');
  if (robber) {
    const target = seatOf(state, state.robberTarget);
    if (target && target !== robber) swapSeats(robber, target);
    state.events.push({ type: 'ROBBER', actorId: robber.playerId, targetId: target ? target.playerId : null });
  }

  const tm = state.seats.find(s => s.initial === 'TROUBLEMAKER');
  if (tm) {
    const a = seatOf(state, state.tmPair?.[0]);
    const b = seatOf(state, state.tmPair?.[1]);
    if (a && b && a !== b) swapSeats(a, b);
    state.events.push({ type: 'TROUBLEMAKER', actorId: tm.playerId, aId: a ? a.playerId : null, bId: b ? b.playerId : null });
  }

  const drunk = state.seats.find(s => s.initial === 'DRUNK');
  if (drunk && state.drunkIndex !== null) {
    const i = state.drunkIndex;
    const t = drunk.current;
    drunk.current = state.center[i];
    state.center[i] = t;
    state.events.push({ type: 'DRUNK', actorId: drunk.playerId, index: i });
  }

  const insomniac = state.seats.find(s => s.initial === 'INSOMNIAC');
  if (insomniac) addIntel(state, insomniac.playerId, { kind: 'INSOMNIAC', role: insomniac.current });

  state.phase = 'DAY';
  state.dayStartedAt = Date.now();
}

// 房主強制：沒做完的人視為放棄行動
function forceNight(state: OneNightState) {
  for (const s of state.seats) s.done = true;
  resolveNight(state);
}

function beginVote(state: OneNightState) {
  state.votes = {};
  state.phase = 'VOTE';
}

// ───────── 勝負 ─────────

export function evaluateOutcome(
  seats: Pick<OneNightSeat, 'playerId' | 'current'>[],
  tally: Record<string, number>,
  votes: Record<string, string>
): OneNightOutcome {
  const ids = seats.map(s => s.playerId);
  const max = Math.max(0, ...ids.map(id => tally[id] || 0));
  let outIds: string[] = [];
  if (max > 0 && !ids.every(id => (tally[id] || 0) === 1)) outIds = ids.filter(id => (tally[id] || 0) === max);

  // 獵人出局時，他投的那個人也出局
  const hunter = seats.find(s => s.current === 'HUNTER' && outIds.includes(s.playerId));
  let hunterShotId: string | null = null;
  if (hunter) {
    const target = votes[hunter.playerId];
    if (target && ids.includes(target)) {
      hunterShotId = target;
      if (!outIds.includes(target)) outIds = [...outIds, target];
    }
  }

  const wolves = seats.filter(s => s.current === 'WOLF').map(s => s.playerId);
  const minions = seats.filter(s => s.current === 'MINION').map(s => s.playerId);
  const goodIds = seats.filter(s => !isWolfTeam(s.current)).map(s => s.playerId);
  const base = { outIds, tally, hunterShotId, hunterId: hunter ? hunter.playerId : null };

  if (wolves.some(id => outIds.includes(id))) {
    return { ...base, winner: 'GOOD', winnerIds: goodIds, reason: '有狼人被投出局，好人陣營獲勝！' };
  }
  if (wolves.length > 0) {
    return {
      ...base,
      winner: 'WOLF',
      winnerIds: seats.filter(s => isWolfTeam(s.current)).map(s => s.playerId),
      reason: '沒有任何狼人出局，狼人陣營獲勝！'
    };
  }
  // 場上玩家沒有狼人（狼都在中央）
  if (outIds.length === 0) {
    return { ...base, winner: 'GOOD', winnerIds: ids.filter(id => !minions.includes(id)), reason: '場上沒有狼人，而且沒人出局，好人陣營獲勝！' };
  }
  if (minions.length > 0) {
    if (outIds.some(id => !minions.includes(id))) {
      return { ...base, winner: 'WOLF', winnerIds: minions, reason: '場上沒有狼人，但有好人出局，爪牙單獨獲勝！' };
    }
    return { ...base, winner: 'GOOD', winnerIds: ids.filter(id => !minions.includes(id)), reason: '場上沒有狼人，出局的只有爪牙，好人陣營獲勝！' };
  }
  return { ...base, winner: 'WOLF', winnerIds: [], reason: '場上沒有狼人卻有人出局，狼人陣營獲勝（所有玩家都輸了）！' };
}

function resolveVote(state: OneNightState) {
  const tally: Record<string, number> = {};
  for (const s of state.seats) tally[s.playerId] = 0;
  for (const [voter, target] of Object.entries(state.votes)) {
    if (seatOf(state, voter) && tally[target] !== undefined) tally[target]++;
  }
  state.outcome = evaluateOutcome(state.seats, tally, state.votes);
  state.phase = 'RESULT';
}

// ───────── 操作 ─────────

export function applyOneNightAction(room: OneNightHostRoom, playerId: string, input: OneNightAction): OneNightMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const mySeat = seatOf(state, playerId);
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });
  const otherSeat = (id: unknown) => (typeof id === 'string' && id !== playerId ? seatOf(state, id) : undefined);
  const validCenter = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < CENTER_COUNT;

  // 夜晚行動共用檢查
  const nightSeat = (): OneNightSeat | { error: string } => {
    if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
    if (!mySeat) return { error: '你是旁觀者' };
    if (mySeat.done) return { error: '你今晚已經行動過了' };
    return mySeat;
  };

  switch (input.action) {
    case 'UPDATE_CONFIG': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY' && state.phase !== 'RESULT') return { error: '對局進行中不能改設定' };
      state.config = sanitizeConfig(state.config, input.config || {}, room.players.length);
      break;
    }

    case 'START': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY' && state.phase !== 'RESULT') return { error: '對局已在進行中' };
      const err = startGame(room);
      if (err) return { error: err };
      break;
    }

    case 'READY': {
      if (state.phase !== 'REVEAL' || !mySeat) return { room };
      mySeat.ready = true;
      if (state.seats.every(s => s.ready)) beginNight(state);
      break;
    }

    case 'NIGHT_ACK': {
      const s = nightSeat();
      if ('error' in s) return s;
      const task = taskOfSeat(state, s);
      if (task !== 'WOLF_ACK' && task !== 'MINION_ACK' && task !== 'INSOMNIAC') return { error: '你今晚要做別的事' };
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'WOLF_PEEK': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (taskOfSeat(state, s) !== 'WOLF_PEEK') return { error: '只有落單的狼人可以偷看中央牌' };
      if (input.index !== null) {
        if (!validCenter(input.index)) return { error: '請選擇一張中央牌' };
        const role = state.initialCenter[input.index];
        addIntel(state, playerId, { kind: 'PEEK_CENTER', indices: [input.index], roles: [role] });
        state.events.push({ type: 'WOLF_PEEK', actorId: playerId, index: input.index, role });
      }
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'SEER_PLAYER': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (s.initial !== 'SEER') return { error: '你不是預言家' };
      const target = otherSeat(input.targetId);
      if (!target) return { error: '請選擇其他玩家' };
      addIntel(state, playerId, { kind: 'SEE_PLAYER', targetId: target.playerId, role: target.initial });
      state.events.push({ type: 'SEER_PLAYER', actorId: playerId, targetId: target.playerId, role: target.initial });
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'SEER_CENTER': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (s.initial !== 'SEER') return { error: '你不是預言家' };
      const [a, b] = input.indices || [];
      if (!validCenter(a) || !validCenter(b) || a === b) return { error: '請選擇兩張不同的中央牌' };
      const roles = [state.initialCenter[a], state.initialCenter[b]];
      addIntel(state, playerId, { kind: 'PEEK_CENTER', indices: [a, b], roles });
      state.events.push({ type: 'SEER_CENTER', actorId: playerId, indices: [a, b], roles });
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'ROBBER': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (s.initial !== 'ROBBER') return { error: '你不是強盜' };
      if (input.targetId !== NONE) {
        const target = otherSeat(input.targetId);
        if (!target) return { error: '請選擇其他玩家' };
        state.robberTarget = target.playerId;
        // 強盜是第一個動手的人，換到的就是對方的「原始」牌
        addIntel(state, playerId, { kind: 'ROBBED', targetId: target.playerId, role: target.initial });
      }
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'TROUBLEMAKER': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (s.initial !== 'TROUBLEMAKER') return { error: '你不是搗蛋鬼' };
      if (!(input.aId === NONE && input.bId === NONE)) {
        const a = otherSeat(input.aId);
        const b = otherSeat(input.bId);
        if (!a || !b || a === b) return { error: '請選擇另外兩位不同的玩家' };
        state.tmPair = [a.playerId, b.playerId];
        addIntel(state, playerId, { kind: 'SWAPPED', aId: a.playerId, bId: b.playerId });
      }
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'DRUNK': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (s.initial !== 'DRUNK') return { error: '你不是酒鬼' };
      if (!validCenter(input.index)) return { error: '請選擇一張中央牌' };
      state.drunkIndex = input.index;
      addIntel(state, playerId, { kind: 'DRUNK', index: input.index });
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'GUESS': {
      const s = nightSeat();
      if ('error' in s) return s;
      if (taskOfSeat(state, s) !== 'GUESS') return { error: '你今晚要做別的事' };
      const target = otherSeat(input.targetId);
      if (!target) return { error: '請選擇其他玩家' };
      state.guesses.push({ playerId, targetId: target.playerId });
      addIntel(state, playerId, { kind: 'GUESS', targetId: target.playerId });
      s.done = true;
      checkNightAdvance(state);
      break;
    }

    case 'FORCE_NIGHT': {
      if (!isHost) return hostOnly();
      if (state.phase === 'REVEAL') beginNight(state); // 有人手機沒反應時，直接進入夜晚
      else if (state.phase === 'NIGHT') forceNight(state);
      break;
    }

    case 'START_VOTE': {
      if (state.phase !== 'DAY') return { room };
      const limit = state.config.dayMinutes * 60 * 1000;
      const expired = limit > 0 && Date.now() - state.dayStartedAt >= limit;
      if (!isHost && !expired) return { error: '時間還沒到，請等房主開始投票' };
      beginVote(state);
      break;
    }

    case 'VOTE': {
      if (state.phase !== 'VOTE') return { error: '現在不是投票時間' };
      if (!mySeat) return { error: '旁觀者不能投票' };
      const target = otherSeat(input.targetId);
      if (!target) return { error: '請投給其他玩家（不能投自己）' };
      state.votes[playerId] = target.playerId;
      if (state.seats.every(s => state.votes[s.playerId])) resolveVote(state);
      break;
    }

    case 'CLOSE_VOTE': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'VOTE') return { room };
      resolveVote(state);
      break;
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      room.gameState = createInitialOneNightState(room.players.length, state.config, inGame(state) ? '房主結束了這一局' : null);
      syncAutoConfig(room);
      return { room };
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
      const target = room.players.find(p => p.id === input.targetId);
      if (!target) return { room };
      const wasSeated = !!seatOf(state, target.id);
      room.players = room.players.filter(p => p.id !== target.id);
      if (inGame(state) && wasSeated) abortToLobby(room, `${target.name} 被房主移出房間，本局中止`);
      else syncAutoConfig(room);
      break;
    }

    case 'LEAVE': {
      // 房主離開等於解散房間，由連線層處理
      if (isHost) return { error: '房主離開會解散房間' };
      const me = room.players.find(p => p.id === playerId);
      room.players = room.players.filter(p => p.id !== playerId);
      if (inGame(state) && mySeat) abortToLobby(room, `${me?.name || '有玩家'} 離開了房間，本局中止`);
      else syncAutoConfig(room);
      break;
    }

    default:
      return { error: '未知的操作指令' };
  }

  return { room };
}

// 新玩家加入或舊玩家重新連線；對局中才加入的人當旁觀者，下一局才有座位
export function addOneNightPlayer(room: OneNightHostRoom, player: { id: string; name: string; secret: string }): OneNightMutation {
  const result = addPeerPlayer(room, player, ONENIGHT_MAX_PLAYERS);
  if ('room' in result) syncAutoConfig(result.room);
  return result;
}

// ───────── 視角 ─────────

function buildNightView(state: OneNightState, mySeat: OneNightSeat | undefined): OneNightNightView | null {
  if (!mySeat || state.phase !== 'NIGHT') return null;
  return {
    progress: { done: state.seats.filter(s => s.done).length, total: state.seats.length },
    task: taskOfSeat(state, mySeat),
    myDone: mySeat.done
  };
}

function buildResult(room: OneNightHostRoom): OneNightResultInfo | null {
  const state = room.gameState;
  const outcome = state.outcome;
  if (state.phase !== 'RESULT' || !outcome) return null;
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '已離開的玩家';
  const rows = state.seats.map(s => ({
    playerId: s.playerId,
    name: nameOf(s.playerId),
    initial: s.initial,
    final: s.current,
    voteFor: state.votes[s.playerId] ?? null,
    votesReceived: outcome.tally[s.playerId] || 0,
    isOut: outcome.outIds.includes(s.playerId),
    won: outcome.winnerIds.includes(s.playerId)
  }));
  const bestIntuition = state.guesses.filter(g => seatOf(state, g.targetId)?.initial === 'WOLF');
  return {
    rows,
    initialCenter: state.initialCenter,
    finalCenter: state.center,
    events: state.events,
    outcome,
    bestIntuition,
    guessTotal: state.guesses.length
  };
}

export function buildOneNightView(room: OneNightHostRoom, playerId: string, onlineIds: Set<string>): OneNightRoomView {
  const state = room.gameState;
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '已離開的玩家';
  const mySeat = seatOf(state, playerId);
  const me = room.players.find(p => p.id === playerId);
  const phase = state.phase;

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) })),
    phase,
    config: state.config,
    notice: state.notice,
    seats: state.seats.map(s => ({
      playerId: s.playerId,
      name: nameOf(s.playerId),
      ready: s.ready,
      hasVoted: phase === 'VOTE' && !!state.votes[s.playerId]
    })),
    mySeat: mySeat ? { initial: mySeat.initial, ready: mySeat.ready } : null,
    night: buildNightView(state, mySeat),
    intel: mySeat ? state.intel[playerId] ?? [] : [],
    dayStartedAt: state.dayStartedAt,
    myVote: state.votes[playerId] ?? null,
    votedCount: phase === 'VOTE' ? state.seats.filter(s => state.votes[s.playerId]).length : 0,
    result: buildResult(room)
  };
}

export const oneNightEngine: PeerGameEngine<OneNightHostRoom, OneNightRoomView, OneNightAction> = {
  codePrefix: 'ONW',
  storageKey: 'onenight',
  createRoom: (id, host) => ({ id, hostId: host.id, version: 1, players: [host], gameState: createInitialOneNightState(1) }),
  addPlayer: addOneNightPlayer,
  applyAction: applyOneNightAction,
  buildView: buildOneNightView,
  botAction: oneNightBotAction
};
