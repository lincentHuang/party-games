/**
 * 狼人殺（手機當法官）- 多手機房間版規則引擎（只在房主手機上執行）
 * 發牌、夜晚行動結算、白天輪流發言、投票放逐、獵人開槍、勝負判定全部由這裡處理，
 * 每支手機只拿到自己有權看到的資訊（buildWerewolfView）。
 *
 * 引擎沒有計時器，只被「操作」驅動：夜晚等所有存活者都完成才進下一步，
 * 卡住時房主可以強制推進（FORCE_NIGHT／CONTINUE／CLOSE_VOTE）。
 */

import { addPeerPlayer, shuffle } from '@/lib/peerRoom';
import { werewolfBotAction } from '@/lib/bots/werewolfBot';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';
import {
  DeathCause,
  NONE,
  NightState,
  WerewolfAction,
  WerewolfConfig,
  WerewolfEvent,
  WerewolfHostRoom,
  WerewolfNightView,
  WerewolfRole,
  WerewolfRoomView,
  WerewolfSeat,
  WerewolfState,
  WerewolfTeam,
  WinMode
} from '@/types/werewolfRoom';

export type WerewolfMutation = PeerMutation<WerewolfHostRoom>;

export const WEREWOLF_MIN_PLAYERS = 6;
export const WEREWOLF_MAX_PLAYERS = 12;

const GOD_ROLES: WerewolfRole[] = ['SEER', 'WITCH', 'HUNTER', 'GUARD'];

// ───────── 配置 ─────────

type RoleSetup = Pick<WerewolfConfig, 'wolfCount' | 'seer' | 'witch' | 'hunter' | 'guard'>;

// 依人數的預設配置
export function defaultSetup(playerCount: number): RoleSetup {
  const n = Math.min(Math.max(playerCount, WEREWOLF_MIN_PLAYERS), WEREWOLF_MAX_PLAYERS);
  if (n <= 6) return { wolfCount: 2, seer: true, witch: true, hunter: false, guard: false };
  if (n <= 7) return { wolfCount: 2, seer: true, witch: true, hunter: true, guard: false };
  if (n <= 9) return { wolfCount: 3, seer: true, witch: true, hunter: true, guard: false };
  if (n === 10) return { wolfCount: 3, seer: true, witch: true, hunter: true, guard: true };
  return { wolfCount: 4, seer: true, witch: true, hunter: true, guard: true };
}

// 狼人數必須少於好人
export function maxWolvesFor(playerCount: number): number {
  return Math.max(1, Math.floor((Math.max(playerCount, WEREWOLF_MIN_PLAYERS) - 1) / 2));
}

export function godCountOf(config: WerewolfConfig): number {
  return [config.seer, config.witch, config.hunter, config.guard].filter(Boolean).length;
}

export function villagerCountFor(playerCount: number, config: WerewolfConfig): number {
  return playerCount - config.wolfCount - godCountOf(config);
}

function createFreshNight(): NightState {
  return {
    guardSet: false,
    guardTarget: null,
    wolfPicks: {},
    wolfLocked: false,
    wolfTarget: null,
    seerDone: false,
    reflect: {},
    witchDone: false,
    witchSave: false,
    witchPoison: null,
    ack: {}
  };
}

export function createInitialWerewolfState(playerCount = 1, config?: WerewolfConfig): WerewolfState {
  return {
    phase: 'LOBBY',
    config: config ?? {
      auto: true,
      ...defaultSetup(playerCount),
      winMode: 'SIDE',
      speechTime: 45,
      showRoleOnDeath: false
    },
    round: 1,
    seats: [],
    night: createFreshNight(),
    antidoteLeft: true,
    poisonLeft: true,
    lastGuardTarget: null,
    seerChecks: [],
    suspicions: [],
    events: [],
    dawnDeaths: [],
    afterPhase: 'DAY',
    lastWords: null,
    hunter: null,
    speakQueue: [],
    speakIndex: 0,
    speakStartedAt: 0,
    votes: {},
    candidates: [],
    voteAttempt: 0,
    ballots: [],
    lastExile: null,
    winner: null,
    winReason: ''
  };
}

function sanitizeConfig(current: WerewolfConfig, patch: Partial<WerewolfConfig>, playerCount: number): WerewolfConfig {
  const next = { ...current };
  if (patch.auto === true) {
    next.auto = true;
    Object.assign(next, defaultSetup(playerCount));
  }
  const manual =
    typeof patch.wolfCount === 'number' ||
    typeof patch.seer === 'boolean' ||
    typeof patch.witch === 'boolean' ||
    typeof patch.hunter === 'boolean' ||
    typeof patch.guard === 'boolean';
  if (typeof patch.wolfCount === 'number') next.wolfCount = Math.min(Math.max(1, Math.floor(patch.wolfCount)), maxWolvesFor(playerCount));
  if (typeof patch.seer === 'boolean') next.seer = patch.seer;
  if (typeof patch.witch === 'boolean') next.witch = patch.witch;
  if (typeof patch.hunter === 'boolean') next.hunter = patch.hunter;
  if (typeof patch.guard === 'boolean') next.guard = patch.guard;
  if (manual && patch.auto !== true) next.auto = false;
  if (patch.winMode === 'SIDE' || patch.winMode === 'CITY') next.winMode = patch.winMode as WinMode;
  if (typeof patch.speechTime === 'number') next.speechTime = Math.min(Math.max(0, Math.floor(patch.speechTime)), 300);
  if (typeof patch.showRoleOnDeath === 'boolean') next.showRoleOnDeath = patch.showRoleOnDeath;
  return next;
}

// 配置跟著人數走（房主還沒手動調整時）
function syncAutoConfig(room: WerewolfHostRoom) {
  const state = room.gameState;
  if (state.phase === 'LOBBY' && state.config.auto) Object.assign(state.config, defaultSetup(room.players.length));
}

// ───────── 小工具 ─────────

const seatOf = (state: WerewolfState, id: string | null | undefined) =>
  id ? state.seats.find(s => s.playerId === id) : undefined;
const aliveSeats = (state: WerewolfState) => state.seats.filter(s => s.isAlive);
const isGod = (role: WerewolfRole) => GOD_ROLES.includes(role);

function teamOf(role: WerewolfRole): WerewolfTeam {
  return role === 'WOLF' ? 'WOLF' : 'GOOD';
}

// ───────── 勝負 ─────────

export function checkVictory(seats: WerewolfSeat[], mode: WinMode): { isOver: boolean; winner: WerewolfTeam | null; reason: string } {
  const alive = seats.filter(s => s.isAlive);
  if (!alive.some(s => s.role === 'WOLF')) {
    return { isOver: true, winner: 'GOOD', reason: '所有狼人都出局了，好人獲勝！' };
  }
  const aliveGood = alive.filter(s => s.role !== 'WOLF');
  if (aliveGood.length === 0) {
    return { isOver: true, winner: 'WOLF', reason: '好人全數出局，狼人獲勝！' };
  }
  if (mode === 'SIDE') {
    const hasGods = seats.some(s => isGod(s.role));
    if (hasGods && !alive.some(s => isGod(s.role))) {
      return { isOver: true, winner: 'WOLF', reason: '所有神職都出局了（屠邊），狼人獲勝！' };
    }
    const hasVillagers = seats.some(s => s.role === 'VILLAGER');
    if (hasVillagers && !alive.some(s => s.role === 'VILLAGER')) {
      return { isOver: true, winner: 'WOLF', reason: '所有平民都出局了（屠邊），狼人獲勝！' };
    }
  }
  return { isOver: false, winner: null, reason: '' };
}

function finishIfOver(state: WerewolfState): boolean {
  const v = checkVictory(state.seats, state.config.winMode);
  if (v.isOver) {
    state.winner = v.winner;
    state.winReason = v.reason;
  }
  return v.isOver;
}

// ───────── 死亡 ─────────

function killSeat(state: WerewolfState, seat: WerewolfSeat, cause: DeathCause) {
  if (!seat.isAlive) return;
  seat.isAlive = false;
  seat.deathRound = state.round;
  seat.deathCause = cause;
}

function pushEvent(state: WerewolfState, e: Omit<WerewolfEvent, 'round'>) {
  state.events.push({ round: state.round, ...e });
}

// ───────── 夜晚 ─────────

function beginNight(state: WerewolfState, round: number) {
  state.round = round;
  state.phase = 'NIGHT';
  state.night = createFreshNight();
  state.dawnDeaths = [];
  state.lastWords = null;
  state.hunter = null;
  state.votes = {};
  state.candidates = [];
  state.voteAttempt = 0;
  state.ballots = [];
  state.lastExile = null;
}

function isNightDone(state: WerewolfState, seat: WerewolfSeat): boolean {
  if (!seat.isAlive) return true;
  const n = state.night;
  if (state.phase === 'NIGHT_WITCH') return seat.role === 'WITCH' ? n.witchDone : !!n.ack[seat.playerId];
  switch (seat.role) {
    case 'GUARD': return n.guardSet;
    case 'WOLF': return n.wolfLocked;
    case 'SEER': return n.seerDone;
    default: return n.reflect[seat.playerId] !== undefined;
  }
}

function nightProgress(state: WerewolfState) {
  const alive = aliveSeats(state);
  return { done: alive.filter(s => isNightDone(state, s)).length, total: alive.length };
}

// 所有存活狼人選同一人（或都選空刀）才鎖定
function recomputeWolfLock(state: WerewolfState) {
  const n = state.night;
  const wolves = aliveSeats(state).filter(s => s.role === 'WOLF');
  const picks = wolves.map(w => n.wolfPicks[w.playerId]);
  if (wolves.length > 0 && picks.every(p => p !== undefined && p === picks[0])) {
    n.wolfLocked = true;
    n.wolfTarget = picks[0] === NONE ? null : picks[0];
  } else {
    n.wolfLocked = false;
    n.wolfTarget = null;
  }
}

// 房主強制：以多數為準，平手隨機，沒人選就空刀
function forceWolfLock(state: WerewolfState) {
  const n = state.night;
  if (n.wolfLocked) return;
  const tally: Record<string, number> = {};
  for (const w of aliveSeats(state).filter(s => s.role === 'WOLF')) {
    const pick = n.wolfPicks[w.playerId];
    if (pick !== undefined) tally[pick] = (tally[pick] || 0) + 1;
  }
  const max = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter(id => tally[id] === max);
  const chosen = leaders.length > 0 ? leaders[Math.floor(Math.random() * leaders.length)] : NONE;
  n.wolfLocked = true;
  n.wolfTarget = chosen === NONE ? null : chosen;
}

function checkNightAdvance(state: WerewolfState) {
  if (state.phase === 'NIGHT' && aliveSeats(state).every(s => isNightDone(state, s))) {
    state.phase = 'NIGHT_WITCH';
  }
  if (state.phase === 'NIGHT_WITCH' && aliveSeats(state).every(s => isNightDone(state, s))) {
    resolveNight(state);
  }
}

// 結算：被刀且沒被救也沒被守→死；同守同救→死；被毒→死（毒穿守護）
function resolveNight(state: WerewolfState) {
  const n = state.night;
  const guardSeat = state.seats.find(s => s.role === 'GUARD');
  const target = n.wolfLocked ? n.wolfTarget : null;
  const deaths = new Map<string, DeathCause>();

  pushEvent(state, { step: 'NIGHT', type: 'WOLF_KILL', targetId: target });
  if (guardSeat?.isAlive) pushEvent(state, { step: 'NIGHT', type: 'GUARD', actorId: guardSeat.playerId, targetId: n.guardTarget });

  const witchSeat = state.seats.find(s => s.role === 'WITCH');
  if (n.witchSave && target) pushEvent(state, { step: 'NIGHT', type: 'SAVE', actorId: witchSeat?.playerId, targetId: target });
  if (n.witchPoison) pushEvent(state, { step: 'NIGHT', type: 'POISON', actorId: witchSeat?.playerId, targetId: n.witchPoison });

  if (target && seatOf(state, target)?.isAlive) {
    const guarded = n.guardTarget === target;
    // 只被守或只被救：活下來；同守同救或都沒有：死亡
    if (guarded === n.witchSave) deaths.set(target, 'WOLF');
  }
  if (n.witchPoison && seatOf(state, n.witchPoison)?.isAlive) deaths.set(n.witchPoison, 'POISON');

  state.lastGuardTarget = n.guardTarget;

  for (const [id, cause] of deaths) {
    const seat = seatOf(state, id)!;
    killSeat(state, seat, cause);
    pushEvent(state, { step: 'NIGHT', type: 'DEATH', targetId: id, cause });
    // 獵人只要不是被毒死就能開槍
    if (seat.role === 'HUNTER' && cause !== 'POISON') {
      state.hunter = { hunterId: id, resolved: false, targetId: null };
    }
  }

  state.dawnDeaths = shuffle([...deaths.keys()]);
  // 首夜死者有遺言
  state.lastWords = state.round === 1 && state.dawnDeaths.length > 0 ? { queue: [...state.dawnDeaths], index: 0 } : null;
  skipLeftSpeakers(state);
  state.afterPhase = 'DAY';
  state.phase = 'DAWN';
}

// ───────── 遺言／獵人／往下一步 ─────────

function skipLeftSpeakers(state: WerewolfState) {
  const lw = state.lastWords;
  if (!lw) return;
  while (lw.index < lw.queue.length && seatOf(state, lw.queue[lw.index])?.left) lw.index++;
}

// 宣告完畢（DAWN／EXILE／HUNTER）後：先處理獵人，再判勝負，再進白天或下一夜
function proceed(state: WerewolfState) {
  const h = state.hunter;
  if (h && !h.resolved) {
    if (seatOf(state, h.hunterId)?.left) {
      h.resolved = true; // 人都離開了，視同放棄
    } else if (state.phase !== 'HUNTER') {
      state.phase = 'HUNTER';
      return;
    } else {
      h.resolved = true;
    }
  }
  state.hunter = null;
  state.lastWords = null;
  if (finishIfOver(state)) {
    state.phase = 'RESULT';
    return;
  }
  if (state.afterPhase === 'DAY') beginDay(state);
  else beginNight(state, state.round + 1);
}

// ───────── 白天發言／投票 ─────────

function beginDay(state: WerewolfState) {
  const alive = aliveSeats(state);
  const starter = alive[Math.floor(Math.random() * alive.length)];
  const startIdx = state.seats.findIndex(s => s.playerId === starter.playerId);
  const ordered = [...state.seats.slice(startIdx), ...state.seats.slice(0, startIdx)];
  state.speakQueue = ordered.filter(s => s.isAlive).map(s => s.playerId);
  state.speakIndex = 0;
  state.speakStartedAt = Date.now();
  state.votes = {};
  state.candidates = [];
  state.voteAttempt = 0;
  state.ballots = [];
  state.lastWords = null;
  state.phase = 'DAY';
}

function beginVote(state: WerewolfState, candidates: string[]) {
  state.phase = 'VOTE';
  state.votes = {};
  state.candidates = candidates;
}

function advanceSpeaker(state: WerewolfState) {
  const alive = new Set(aliveSeats(state).map(s => s.playerId));
  let idx = state.speakIndex + 1;
  while (idx < state.speakQueue.length && !alive.has(state.speakQueue[idx])) idx++;
  if (idx >= state.speakQueue.length) {
    beginVote(state, [...alive]);
  } else {
    state.speakIndex = idx;
    state.speakStartedAt = Date.now();
  }
}

function allAliveVoted(state: WerewolfState): boolean {
  return aliveSeats(state).every(s => !!state.votes[s.playerId]);
}

function resolveVote(state: WerewolfState) {
  const tally: Record<string, number> = {};
  for (const target of Object.values(state.votes)) {
    if (target === NONE) continue;
    tally[target] = (tally[target] || 0) + 1;
  }
  state.ballots.push({ attempt: state.voteAttempt, votes: { ...state.votes } });

  const max = Math.max(0, ...Object.values(tally));
  const leaders = max > 0 ? Object.keys(tally).filter(id => tally[id] === max) : [];

  // 第一次平票：平票者 PK 重投；再平票就無人放逐
  if (leaders.length > 1 && state.voteAttempt === 0) {
    state.voteAttempt = 1;
    beginVote(state, leaders);
    return;
  }

  state.afterPhase = 'NIGHT';
  state.phase = 'EXILE';
  state.lastWords = null;
  state.hunter = null;
  let exiledId: string | null = null;

  if (leaders.length === 1) {
    const seat = seatOf(state, leaders[0])!;
    exiledId = seat.playerId;
    killSeat(state, seat, 'EXILE');
    pushEvent(state, { step: 'DAY', type: 'EXILE', targetId: exiledId });
    pushEvent(state, { step: 'DAY', type: 'DEATH', targetId: exiledId, cause: 'EXILE' });
    if (seat.role === 'HUNTER') state.hunter = { hunterId: exiledId, resolved: false, targetId: null };
    state.lastWords = { queue: [exiledId], index: 0 };
    skipLeftSpeakers(state);
  } else {
    pushEvent(state, { step: 'DAY', type: 'EXILE', targetId: null });
  }
  state.lastExile = { round: state.round, playerId: exiledId, tally, ballots: state.ballots.map(b => ({ ...b })) };
}

// ───────── 離開／移出 ─────────

// 玩家在對局中離開：視同死亡（不觸發技能），修正各階段進度並判勝負
function removeFromGame(state: WerewolfState, playerId: string) {
  const seat = seatOf(state, playerId);
  if (!seat || state.phase === 'LOBBY' || state.phase === 'RESULT') return;

  const wasCurrentSpeaker = state.phase === 'DAY' && state.speakQueue[state.speakIndex] === playerId;
  if (seat.isAlive) {
    killSeat(state, seat, 'LEAVE');
    pushEvent(state, { step: state.phase === 'NIGHT' || state.phase === 'NIGHT_WITCH' ? 'NIGHT' : 'DAY', type: 'LEAVE', targetId: playerId });
  }
  seat.left = true;
  delete state.votes[playerId];
  for (const [voter, target] of Object.entries(state.votes)) {
    if (target === playerId) delete state.votes[voter];
  }

  if (finishIfOver(state)) {
    state.phase = 'RESULT';
    return;
  }

  switch (state.phase) {
    case 'REVEAL':
      if (state.seats.filter(s => !s.left).every(s => s.ready)) beginNight(state, 1);
      break;
    case 'NIGHT': {
      const n = state.night;
      delete n.wolfPicks[playerId];
      for (const [wolf, target] of Object.entries(n.wolfPicks)) {
        if (target === playerId) delete n.wolfPicks[wolf];
      }
      recomputeWolfLock(state);
      checkNightAdvance(state);
      break;
    }
    case 'NIGHT_WITCH':
      checkNightAdvance(state);
      break;
    case 'DAWN':
    case 'EXILE':
      skipLeftSpeakers(state);
      break;
    case 'HUNTER':
      if (state.hunter && state.hunter.hunterId === playerId) state.hunter.resolved = true;
      break;
    case 'DAY':
      if (wasCurrentSpeaker) advanceSpeaker(state);
      break;
    case 'VOTE':
      state.candidates = state.candidates.filter(id => id !== playerId);
      if (state.candidates.length < 2) beginVote(state, aliveSeats(state).map(s => s.playerId));
      else if (allAliveVoted(state)) resolveVote(state);
      break;
  }
}

// ───────── 操作 ─────────

export function applyWerewolfAction(room: WerewolfHostRoom, playerId: string, input: WerewolfAction): WerewolfMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const mySeat = seatOf(state, playerId);
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });
  const aliveMe = mySeat?.isAlive ? mySeat : undefined;
  // 目標必須是存活者，或「不選」
  const validTarget = (id: unknown, allowNone: boolean, allowSelf: boolean): id is string => {
    if (typeof id !== 'string') return false;
    if (id === NONE) return allowNone;
    if (id === playerId && !allowSelf) return false;
    return !!seatOf(state, id)?.isAlive;
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
      const total = room.players.length;
      if (total < WEREWOLF_MIN_PLAYERS) return { error: `至少需要 ${WEREWOLF_MIN_PLAYERS} 位玩家才能開始` };
      if (total > WEREWOLF_MAX_PLAYERS) return { error: `最多 ${WEREWOLF_MAX_PLAYERS} 位玩家` };
      if (state.config.auto) Object.assign(state.config, defaultSetup(total));
      state.config.wolfCount = Math.min(state.config.wolfCount, maxWolvesFor(total));
      const villagers = villagerCountFor(total, state.config);
      if (villagers < 1) return { error: '神職太多了，至少要留 1 位平民（可以減少神職或狼人）' };

      const roles: WerewolfRole[] = [];
      for (let i = 0; i < state.config.wolfCount; i++) roles.push('WOLF');
      if (state.config.seer) roles.push('SEER');
      if (state.config.witch) roles.push('WITCH');
      if (state.config.hunter) roles.push('HUNTER');
      if (state.config.guard) roles.push('GUARD');
      while (roles.length < total) roles.push('VILLAGER');
      const dealt = shuffle(roles);

      const config = state.config;
      Object.assign(state, createInitialWerewolfState(total, config));
      state.seats = room.players.map((p, i) => ({
        playerId: p.id,
        role: dealt[i],
        isAlive: true,
        deathRound: null,
        deathCause: null,
        left: false,
        ready: false
      }));
      state.phase = 'REVEAL';
      break;
    }

    case 'READY': {
      if (state.phase !== 'REVEAL' || !mySeat) return { room };
      mySeat.ready = true;
      if (state.seats.filter(s => !s.left).every(s => s.ready)) beginNight(state, 1);
      break;
    }

    case 'GUARD': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || aliveMe.role !== 'GUARD') return { error: '你不是守衛' };
      if (!validTarget(input.targetId, true, true)) return { error: '請選擇存活的玩家' };
      if (input.targetId !== NONE && input.targetId === state.lastGuardTarget) return { error: '不能連續兩晚守護同一個人' };
      state.night.guardSet = true;
      state.night.guardTarget = input.targetId === NONE ? null : input.targetId;
      checkNightAdvance(state);
      break;
    }

    case 'WOLF_PICK': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || aliveMe.role !== 'WOLF') return { error: '你不是狼人' };
      if (!validTarget(input.targetId, true, true)) return { error: '請選擇存活的玩家' };
      state.night.wolfPicks[playerId] = input.targetId;
      recomputeWolfLock(state);
      checkNightAdvance(state);
      break;
    }

    case 'SEER_CHECK': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || aliveMe.role !== 'SEER') return { error: '你不是預言家' };
      if (state.night.seerDone) return { error: '今晚已經查驗過了' };
      if (!validTarget(input.targetId, false, false)) return { error: '請選擇其他存活的玩家' };
      const isWolf = seatOf(state, input.targetId)!.role === 'WOLF';
      state.seerChecks.push({ round: state.round, targetId: input.targetId, isWolf });
      pushEvent(state, { step: 'NIGHT', type: 'SEER', actorId: playerId, targetId: input.targetId, isWolf });
      state.night.seerDone = true;
      checkNightAdvance(state);
      break;
    }

    case 'REFLECT': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || ['GUARD', 'WOLF', 'SEER'].includes(aliveMe.role)) return { error: '你今晚不需要做夜間推理' };
      if (!validTarget(input.targetId, false, false)) return { error: '請選擇其他存活的玩家' };
      state.night.reflect[playerId] = input.targetId;
      state.suspicions = state.suspicions.filter(s => !(s.round === state.round && s.playerId === playerId));
      state.suspicions.push({ round: state.round, playerId, targetId: input.targetId });
      checkNightAdvance(state);
      break;
    }

    case 'WITCH': {
      if (state.phase !== 'NIGHT_WITCH') return { error: '現在不是女巫行動時間' };
      if (!aliveMe || aliveMe.role !== 'WITCH') return { error: '你不是女巫' };
      if (state.night.witchDone) return { error: '今晚已經行動過了' };
      const n = state.night;
      if (input.choice === 'SAVE') {
        if (!state.antidoteLeft) return { error: '解藥已經用掉了' };
        if (!n.wolfTarget) return { error: '今晚沒有人被刀' };
        if (n.wolfTarget === playerId) return { error: '女巫不能自救' };
        n.witchSave = true;
        state.antidoteLeft = false;
      } else if (input.choice === 'POISON') {
        if (!state.poisonLeft) return { error: '毒藥已經用掉了' };
        if (!validTarget(input.targetId, false, false)) return { error: '請選擇其他存活的玩家' };
        n.witchPoison = input.targetId;
        state.poisonLeft = false;
      } else if (input.choice !== 'NONE') {
        return { error: '未知的選擇' };
      }
      n.witchDone = true;
      checkNightAdvance(state);
      break;
    }

    case 'NIGHT_ACK': {
      if (state.phase !== 'NIGHT_WITCH' || !aliveMe) return { room };
      if (aliveMe.role === 'WITCH') return { error: '請選擇你的行動' };
      state.night.ack[playerId] = true;
      checkNightAdvance(state);
      break;
    }

    case 'FORCE_NIGHT': {
      if (!isHost) return hostOnly();
      if (state.phase === 'NIGHT') {
        forceWolfLock(state);
        state.phase = 'NIGHT_WITCH';
        checkNightAdvance(state);
      } else if (state.phase === 'NIGHT_WITCH') {
        resolveNight(state);
      }
      break;
    }

    case 'LAST_WORDS_DONE': {
      if (state.phase !== 'DAWN' && state.phase !== 'EXILE') return { room };
      const lw = state.lastWords;
      if (!lw || lw.index >= lw.queue.length) return { room };
      if (lw.queue[lw.index] !== playerId && !isHost) return { error: '只有正在發表遺言的人或房主可以結束' };
      lw.index++;
      skipLeftSpeakers(state);
      break;
    }

    case 'HUNTER_SHOT': {
      const h = state.hunter;
      if (state.phase !== 'HUNTER' || !h || h.resolved) return { error: '現在不是獵人開槍時間' };
      if (h.hunterId !== playerId) return { error: '只有獵人可以開槍' };
      if (!validTarget(input.targetId, true, false)) return { error: '請選擇其他存活的玩家，或放棄開槍' };
      h.resolved = true;
      h.targetId = input.targetId === NONE ? null : input.targetId;
      pushEvent(state, { step: state.afterPhase === 'DAY' ? 'NIGHT' : 'DAY', type: 'HUNTER', actorId: playerId, targetId: h.targetId });
      if (h.targetId) {
        killSeat(state, seatOf(state, h.targetId)!, 'HUNTER');
        pushEvent(state, { step: state.afterPhase === 'DAY' ? 'NIGHT' : 'DAY', type: 'DEATH', targetId: h.targetId, cause: 'HUNTER' });
      }
      break;
    }

    case 'NEXT_SPEAKER': {
      if (state.phase !== 'DAY') return { room };
      if (state.speakQueue[state.speakIndex] !== playerId && !isHost) return { error: '只有正在發言的人或房主可以換下一位' };
      advanceSpeaker(state);
      break;
    }

    case 'VOTE': {
      if (state.phase !== 'VOTE') return { error: '現在不是投票時間' };
      if (!aliveMe) return { error: '出局的玩家不能投票' };
      if (input.targetId !== NONE) {
        if (input.targetId === playerId) return { error: '不能投給自己' };
        if (!state.candidates.includes(input.targetId)) return { error: '這位玩家不在投票名單中' };
      }
      state.votes[playerId] = input.targetId;
      if (allAliveVoted(state)) resolveVote(state);
      break;
    }

    case 'CLOSE_VOTE': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'VOTE') return { room };
      resolveVote(state);
      break;
    }

    case 'CONTINUE': {
      if (!isHost) return hostOnly();
      if (state.phase === 'REVEAL') {
        beginNight(state, 1); // 房主強制開始（有人手機沒反應時）
      } else if (state.phase === 'DAWN' || state.phase === 'EXILE' || state.phase === 'HUNTER') {
        proceed(state);
      }
      break;
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      room.gameState = createInitialWerewolfState(room.players.length, state.config);
      syncAutoConfig(room);
      return { room };
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
      room.players = room.players.filter(p => p.id !== input.targetId);
      removeFromGame(state, input.targetId);
      syncAutoConfig(room);
      break;
    }

    case 'LEAVE': {
      // 房主離開等於解散房間，由連線層處理
      if (isHost) return { error: '房主離開會解散房間' };
      room.players = room.players.filter(p => p.id !== playerId);
      removeFromGame(state, playerId);
      syncAutoConfig(room);
      break;
    }

    default:
      return { error: '未知的操作指令' };
  }

  return { room };
}

// 新玩家加入或舊玩家重新連線；對局中才加入的人當旁觀者，下一局才有座位
export function addWerewolfPlayer(room: WerewolfHostRoom, player: { id: string; name: string; secret: string }): WerewolfMutation {
  const result = addPeerPlayer(room, player, WEREWOLF_MAX_PLAYERS);
  if ('room' in result) syncAutoConfig(result.room);
  return result;
}

// ───────── 視角 ─────────

function buildNightView(state: WerewolfState, mySeat: WerewolfSeat | undefined): WerewolfNightView | null {
  if (!mySeat || (state.phase !== 'NIGHT' && state.phase !== 'NIGHT_WITCH')) return null;
  const n = state.night;
  const progress = nightProgress(state);
  const myDone = isNightDone(state, mySeat);

  if (!mySeat.isAlive) return { progress, task: 'DEAD', myDone: true };

  if (state.phase === 'NIGHT_WITCH') {
    if (mySeat.role !== 'WITCH') return { progress, task: 'ACK', myDone };
    // 解藥用掉就看不到刀口
    return {
      progress,
      task: 'WITCH',
      myDone,
      witch: { victimKnown: state.antidoteLeft, victimId: state.antidoteLeft ? n.wolfTarget : null }
    };
  }

  switch (mySeat.role) {
    case 'GUARD':
      return { progress, task: 'GUARD', myDone, guard: { target: n.guardSet ? n.guardTarget : null, lastTarget: state.lastGuardTarget } };
    case 'WOLF': {
      // 只給狼人看到存活狼隊友的選擇
      const picks: Record<string, string> = {};
      for (const s of aliveSeats(state)) {
        if (s.role === 'WOLF' && n.wolfPicks[s.playerId] !== undefined) picks[s.playerId] = n.wolfPicks[s.playerId];
      }
      return { progress, task: 'WOLF', myDone, wolf: { picks, locked: n.wolfLocked } };
    }
    case 'SEER':
      return { progress, task: 'SEER', myDone };
    default:
      return { progress, task: 'REFLECT', myDone, reflectTarget: n.reflect[mySeat.playerId] ?? null };
  }
}

export function buildWerewolfView(room: WerewolfHostRoom, playerId: string, onlineIds: Set<string>): WerewolfRoomView {
  const state = room.gameState;
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '已離開的玩家';
  const isOver = state.phase === 'RESULT';
  const mySeat = seatOf(state, playerId);
  const me = room.players.find(p => p.id === playerId);
  const phase = state.phase;

  const seats = state.seats.map(s => {
    const roleVisible = s.playerId === playerId || isOver || (state.config.showRoleOnDeath && !s.isAlive && !s.left);
    return {
      playerId: s.playerId,
      name: nameOf(s.playerId),
      isAlive: s.isAlive,
      deathRound: s.deathRound,
      left: s.left,
      ready: s.ready,
      hasVoted: phase === 'VOTE' && !!state.votes[s.playerId],
      ...(roleVisible ? { role: s.role } : {})
    };
  });

  let result: WerewolfRoomView['result'] = null;
  if (isOver) {
    const stats = new Map<string, { hits: number; total: number }>();
    for (const sus of state.suspicions) {
      const st = stats.get(sus.playerId) || { hits: 0, total: 0 };
      st.total++;
      if (seatOf(state, sus.targetId)?.role === 'WOLF') st.hits++;
      stats.set(sus.playerId, st);
    }
    const top = Math.max(0, ...[...stats.values()].map(s => s.hits));
    result = {
      events: state.events,
      bestDetectives: top > 0
        ? [...stats.entries()].filter(([, s]) => s.hits === top).map(([id, s]) => ({ playerId: id, ...s }))
        : []
    };
  }

  const myPrivate: WerewolfRoomView['mySeat'] = mySeat
    ? {
        role: mySeat.role,
        isAlive: mySeat.isAlive,
        ready: mySeat.ready,
        ...(mySeat.role === 'WOLF'
          ? { mates: state.seats.filter(s => s.role === 'WOLF' && s.playerId !== playerId).map(s => s.playerId) }
          : {}),
        ...(mySeat.role === 'SEER' ? { seerChecks: state.seerChecks } : {}),
        ...(mySeat.role === 'WITCH' ? { potions: { antidote: state.antidoteLeft, poison: state.poisonLeft } } : {})
      }
    : null;

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) })),
    phase,
    config: state.config,
    round: state.round,
    seats,
    mySeat: myPrivate,
    night: buildNightView(state, mySeat),
    dawnDeaths: phase === 'DAWN' ? state.dawnDeaths : [],
    lastWords: phase === 'DAWN' || phase === 'EXILE' ? state.lastWords : null,
    hunter: phase === 'HUNTER' ? state.hunter : null,
    speakQueue: state.speakQueue,
    speakIndex: state.speakIndex,
    speakStartedAt: state.speakStartedAt,
    candidates: state.candidates,
    myVote: state.votes[playerId] || null,
    voteAttempt: state.voteAttempt,
    ballots: phase === 'VOTE' || phase === 'EXILE' ? state.ballots : [],
    lastExile: phase === 'EXILE' ? state.lastExile : null,
    winner: state.winner,
    winReason: state.winReason,
    result
  };
}

export const werewolfEngine: PeerGameEngine<WerewolfHostRoom, WerewolfRoomView, WerewolfAction> = {
  codePrefix: 'WLF',
  storageKey: 'werewolf',
  createRoom: (id, host) => ({ id, hostId: host.id, version: 1, players: [host], gameState: createInitialWerewolfState(1) }),
  addPlayer: addWerewolfPlayer,
  applyAction: applyWerewolfAction,
  buildView: buildWerewolfView,
  botAction: werewolfBotAction
};

export { teamOf };
