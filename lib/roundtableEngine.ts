/**
 * 圓桌狼人（阿瓦隆 + 狼人殺融合版）- 多手機房間版規則引擎（只在房主手機上執行）
 *
 * 白天：阿瓦隆式組隊 → 表決 → 出任務。
 * 夜晚：只有「任務成功」的那一晚狼人才能殺人；預言家查驗、守衛守護、其他人做夜間推理。
 * 勝負：三次任務失敗／連續五次否決／狼人猜中預言家 → 狼人勝；
 *       三次任務成功（預言家已死，或狼人猜錯）／狼人全滅 → 好人勝。
 *
 * 引擎沒有計時器，只被「操作」驅動；卡住時房主可以強制推進（FORCE_RESOLVE／CONTINUE）。
 * 每支手機只拿到自己有權看到的資訊（buildRoundtableView）。
 */

import { ALIGNMENT_COUNT_BY_PLAYERS, generateQuests } from '@/lib/avalonRules';
import { addPeerPlayer, shuffle } from '@/lib/peerRoom';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';
import {
  RT_NONE,
  RoundtableAction,
  RoundtableHostRoom,
  RoundtableRoomView,
  RtConfig,
  RtDeathCause,
  RtEvent,
  RtHuntView,
  RtMySeat,
  RtNightState,
  RtNightView,
  RtPhase,
  RtResolvedConfig,
  RtResultInfo,
  RtRole,
  RtSeat,
  RtState,
  RtTeam,
  RtWolfPick
} from '@/types/roundtableRoom';

export type RoundtableMutation = PeerMutation<RoundtableHostRoom>;

export const RT_MIN_PLAYERS = 5;
export const RT_MAX_PLAYERS = 10;
export const RT_MAX_REJECTS = 5;

// ───────── 配置 ─────────

export function resolveRtConfig(config: RtConfig, playerCount: number): RtResolvedConfig {
  return {
    guard: config.guard ?? playerCount >= 6,
    hunter: config.hunter ?? playerCount >= 8,
    hiddenWolf: config.hiddenWolf ?? playerCount >= 7,
    revealOnDeath: config.revealOnDeath
  };
}

// 依人數與設定決定這局的角色牌組；神職超過好人名額時回傳 null
export function resolveRtRoles(playerCount: number, rc: RtResolvedConfig): { good: RtRole[]; evil: RtRole[] } | null {
  const count = ALIGNMENT_COUNT_BY_PLAYERS[Math.min(Math.max(playerCount, RT_MIN_PLAYERS), RT_MAX_PLAYERS)];
  const good: RtRole[] = ['SEER'];
  if (rc.guard) good.push('GUARD');
  if (rc.hunter) good.push('HUNTER');
  if (good.length > count.good) return null;
  while (good.length < count.good) good.push('KNIGHT');

  const evil: RtRole[] = [];
  if (rc.hiddenWolf) evil.push('HIDDEN_WOLF'); // 佔一個狼人名額
  while (evil.length < count.evil) evil.push('WOLF');
  return { good, evil };
}

function createFreshNight(round = 1, kill = false): RtNightState {
  return {
    round,
    kill,
    wolf: { picks: {}, locked: false, target: null },
    guardSet: false,
    guardTarget: null,
    seerDone: false,
    reflect: {}
  };
}

export function createInitialRtState(config?: RtConfig): RtState {
  return {
    phase: 'LOBBY',
    config: config ?? { guard: null, hunter: null, hiddenWolf: null, revealOnDeath: false },
    seats: [],
    questIndex: 0,
    quests: [],
    leaderId: null,
    rejectCount: 0,
    proposedTeam: [],
    votes: {},
    lastVote: null,
    questCards: {},
    lastQuestFails: null,
    night: createFreshNight(),
    lastGuardTarget: null,
    seerChecks: [],
    suspicions: [],
    events: [],
    dawn: null,
    hunter: null,
    hunt: { picks: {}, locked: false, target: null },
    huntTargetId: null,
    winner: null,
    winReason: ''
  };
}

function sanitizeConfig(current: RtConfig, patch: Partial<RtResolvedConfig>): RtConfig {
  const next = { ...current };
  if (typeof patch.guard === 'boolean') next.guard = patch.guard;
  if (typeof patch.hunter === 'boolean') next.hunter = patch.hunter;
  if (typeof patch.hiddenWolf === 'boolean') next.hiddenWolf = patch.hiddenWolf;
  if (typeof patch.revealOnDeath === 'boolean') next.revealOnDeath = patch.revealOnDeath;
  return next;
}

// ───────── 小工具 ─────────

const seatOf = (state: RtState, id: string | null | undefined) =>
  id ? state.seats.find(s => s.playerId === id) : undefined;
const aliveSeats = (state: RtState) => state.seats.filter(s => s.alive);
const presentSeats = (state: RtState) => state.seats.filter(s => !s.left);
const isEvilSeat = (s: RtSeat) => s.team === 'EVIL';
const isWolfRole = (role: RtRole) => role === 'WOLF' || role === 'HIDDEN_WOLF';

function pushEvent(state: RtState, e: Omit<RtEvent, 'round'>, round?: number) {
  state.events.push({ round: round ?? state.questIndex + 1, ...e });
}

function killSeat(state: RtState, seat: RtSeat, cause: RtDeathCause) {
  if (!seat.alive) return;
  seat.alive = false;
  seat.deathRound = state.questIndex + 1;
  seat.deathCause = cause;
}

// 座位順序上，fromId 之後的下一位「存活者」（fromId 本人死了／離開也可以當起點）
function nextAliveId(state: RtState, fromId: string | null): string | null {
  const n = state.seats.length;
  if (n === 0) return null;
  const from = state.seats.findIndex(s => s.playerId === fromId);
  for (let i = 1; i <= n; i++) {
    const seat = state.seats[(from + i + n) % n];
    if (seat.alive) return seat.playerId;
  }
  return null;
}

function finish(state: RtState, winner: RtTeam, reason: string) {
  if (state.winner) return;
  state.winner = winner;
  state.winReason = reason;
}

// 狼人全滅／好人全滅
function checkAnnihilation(state: RtState): boolean {
  if (state.winner) return true;
  const alive = aliveSeats(state);
  if (!alive.some(isEvilSeat)) {
    finish(state, 'GOOD', '所有狼人都出局了，好人獲勝！');
    return true;
  }
  if (!alive.some(s => s.team === 'GOOD')) {
    finish(state, 'EVIL', '好人全數陣亡，狼人獲勝！');
    return true;
  }
  return false;
}

// ───────── 白天：組隊／表決／任務 ─────────

function startPropose(state: RtState) {
  state.phase = 'PROPOSE';
  state.proposedTeam = [];
  state.votes = {};
  state.questCards = {};
  const quest = state.quests[state.questIndex];
  // 存活人數少於任務人數時，任務人數改為存活人數
  quest.requiredPlayers = Math.min(quest.baseRequired, aliveSeats(state).length);
  if (!seatOf(state, state.leaderId)?.alive) state.leaderId = nextAliveId(state, state.leaderId);
}

function allVoted(state: RtState): boolean {
  return presentSeats(state).every(s => s.playerId in state.votes);
}

// 開票：亡魂也投票；贊成嚴格多於反對才通過；沒投的視為贊成（只有房主強制開票時會發生）
function resolveTeamVote(state: RtState) {
  const votes: Record<string, boolean> = {};
  const voters = presentSeats(state);
  for (const seat of voters) votes[seat.playerId] = state.votes[seat.playerId] ?? true;
  const yes = Object.values(votes).filter(Boolean).length;
  const approved = yes > voters.length - yes;

  if (approved) {
    state.rejectCount = 0;
  } else {
    state.rejectCount += 1;
    if (state.rejectCount >= RT_MAX_REJECTS) {
      finish(state, 'EVIL', `連續 ${RT_MAX_REJECTS} 次組隊被否決，狼人直接獲勝！`);
    }
  }

  state.lastVote = {
    round: state.questIndex + 1,
    leaderId: state.leaderId!,
    team: [...state.proposedTeam],
    votes,
    approved,
    rejectCount: state.rejectCount
  };
  state.votes = {};
  state.phase = 'VOTE_RESULT';
}

// 結算任務；沒交的視為成功（只有房主強制結算時會發生）
function resolveQuest(state: RtState) {
  const quest = state.quests[state.questIndex];
  let fails = 0;
  for (const id of state.proposedTeam) {
    if (state.questCards[id] === 'FAIL') fails += 1;
  }
  const failed = fails >= (quest.requiresTwoFails ? 2 : 1);
  quest.status = failed ? 'FAILED' : 'SUCCESS';
  quest.failCount = fails;
  quest.successCount = state.proposedTeam.length - fails;
  quest.team = [...state.proposedTeam];
  state.lastQuestFails = fails;
  state.questCards = {};

  if (state.quests.filter(q => q.status === 'FAILED').length >= 3) {
    finish(state, 'EVIL', '三次任務失敗，狼人獲勝！');
  } else if (state.quests.filter(q => q.status === 'SUCCESS').length >= 3 && !isSeerAlive(state)) {
    finish(state, 'GOOD', '三次任務成功，而且預言家已經陣亡，狼人沒有逆轉的機會，好人獲勝！');
  }
  state.phase = 'QUEST_RESULT';
}

function isSeerAlive(state: RtState): boolean {
  return state.seats.some(s => s.role === 'SEER' && s.alive);
}

// 任務結算後的下一步：夜晚，或最後獵殺／終局
function afterQuestResult(state: RtState) {
  const successCount = state.quests.filter(q => q.status === 'SUCCESS').length;
  if (!state.winner && successCount >= 3 && !isSeerAlive(state)) {
    finish(state, 'GOOD', '三次任務成功，而且預言家已經陣亡，狼人沒有逆轉的機會，好人獲勝！');
  }
  if (!state.winner) checkAnnihilation(state);
  if (state.winner) {
    state.phase = 'RESULT';
    return;
  }
  if (successCount >= 3) {
    state.phase = 'FINAL_HUNT';
    state.hunt = { picks: {}, locked: false, target: null };
    state.huntTargetId = null;
    return;
  }
  beginNight(state);
}

// ───────── 夜晚 ─────────

function beginNight(state: RtState) {
  const quest = state.quests[state.questIndex];
  state.phase = 'NIGHT';
  state.night = createFreshNight(state.questIndex + 1, quest.status === 'SUCCESS');
  state.dawn = null;
  state.hunter = null;
}

function isNightDone(state: RtState, seat: RtSeat): boolean {
  if (!seat.alive) return true;
  const n = state.night;
  switch (seat.role) {
    case 'GUARD': return n.guardSet;
    case 'SEER': return n.seerDone;
    case 'WOLF':
    case 'HIDDEN_WOLF':
      return n.kill ? n.wolf.locked : n.reflect[seat.playerId] !== undefined;
    default: return n.reflect[seat.playerId] !== undefined;
  }
}

function nightProgress(state: RtState) {
  const alive = aliveSeats(state);
  return { done: alive.filter(s => isNightDone(state, s)).length, total: alive.length };
}

// 所有存活狼人選同一人（或都選空刀）才鎖定
function computeLock(wp: RtWolfPick, wolves: RtSeat[]) {
  const picks = wolves.map(w => wp.picks[w.playerId]);
  if (wolves.length > 0 && picks.every(p => p !== undefined && p === picks[0])) {
    wp.locked = true;
    wp.target = picks[0] === RT_NONE ? null : picks[0];
  } else {
    wp.locked = false;
    wp.target = null;
  }
}

// 房主強制：以多數為準，平手隨機；沒人選就用 fallback（夜晚＝空刀）
function forceLock(wp: RtWolfPick, wolves: RtSeat[], fallbackPool: string[]) {
  if (wp.locked) return;
  const tally: Record<string, number> = {};
  for (const w of wolves) {
    const pick = wp.picks[w.playerId];
    if (pick !== undefined) tally[pick] = (tally[pick] || 0) + 1;
  }
  const max = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter(id => tally[id] === max);
  let chosen: string;
  if (leaders.length > 0) chosen = leaders[Math.floor(Math.random() * leaders.length)];
  else chosen = fallbackPool.length > 0 ? fallbackPool[Math.floor(Math.random() * fallbackPool.length)] : RT_NONE;
  wp.locked = true;
  wp.target = chosen === RT_NONE ? null : chosen;
}

function checkNightAdvance(state: RtState) {
  if (state.phase === 'NIGHT' && aliveSeats(state).every(s => isNightDone(state, s))) resolveNight(state);
}

// 結算：被刀者若被守護→平安夜；否則死亡
function resolveNight(state: RtState) {
  const n = state.night;
  const round = n.round;
  const wolves = aliveSeats(state).filter(s => isWolfRole(s.role));
  let deadId: string | null = null;

  if (n.kill) {
    forceLock(n.wolf, wolves, []); // 理論上已鎖定；保險
    pushEvent(state, { type: 'KILL', targetId: n.wolf.target }, round);
  } else {
    pushEvent(state, { type: 'NO_KILL' }, round);
  }

  const guardSeat = state.seats.find(s => s.role === 'GUARD' && s.alive);
  if (guardSeat && n.guardTarget) pushEvent(state, { type: 'GUARD', actorId: guardSeat.playerId, targetId: n.guardTarget }, round);
  state.lastGuardTarget = n.guardTarget;

  const target = n.kill ? n.wolf.target : null;
  if (target && seatOf(state, target)?.alive && n.guardTarget !== target) {
    const seat = seatOf(state, target)!;
    killSeat(state, seat, 'WOLF');
    deadId = target;
    pushEvent(state, { type: 'DEATH', targetId: target, cause: 'WOLF' }, round);
    // 夜裡被狼殺死的獵人可以開槍
    if (seat.role === 'HUNTER') state.hunter = { hunterId: target, resolved: false, targetId: null };
  }

  state.dawn = { kill: n.kill, deadId };
  state.phase = 'DAWN';
}

// 宣告完畢（DAWN／HUNTER）後：先處理獵人，再判勝負，再輪到下一位存活隊長進入下一輪
function proceedFromDawn(state: RtState) {
  const h = state.hunter;
  if (h && !h.resolved) {
    if (seatOf(state, h.hunterId)?.left) {
      h.resolved = true; // 人都離開了，視同放棄
    } else if (state.phase !== 'HUNTER') {
      state.phase = 'HUNTER';
      return;
    } else {
      h.resolved = true; // 房主強制：視為放棄
    }
  }
  state.hunter = null;
  state.dawn = null;
  if (checkAnnihilation(state)) {
    state.phase = 'RESULT';
    return;
  }
  state.questIndex += 1;
  state.leaderId = nextAliveId(state, state.leaderId);
  startPropose(state);
}

function resolveHunt(state: RtState, targetId: string) {
  state.huntTargetId = targetId;
  state.hunt.locked = true;
  state.hunt.target = targetId;
  if (seatOf(state, targetId)?.role === 'SEER') {
    finish(state, 'EVIL', `狼人在最後獵殺中猜中了預言家，狼人逆轉獲勝！`);
  } else {
    finish(state, 'GOOD', `狼人猜錯了，被指認的人不是預言家，好人守住勝利！`);
  }
  state.phase = 'RESULT';
}

const huntCandidates = (state: RtState) => aliveSeats(state).filter(s => s.team === 'GOOD').map(s => s.playerId);

// ───────── 離開／移出 ─────────

// 玩家在對局中離開：視同死亡（不觸發獵人），修正各階段進度並判勝負
function removeFromGame(state: RtState, playerId: string) {
  const seat = seatOf(state, playerId);
  if (!seat || state.phase === 'LOBBY' || state.phase === 'RESULT') return;

  const wasLeader = state.leaderId === playerId;
  if (seat.alive) {
    killSeat(state, seat, 'LEAVE');
    pushEvent(state, { type: 'LEAVE', targetId: playerId });
  }
  seat.left = true;
  seat.alive = false;
  delete state.votes[playerId];
  delete state.questCards[playerId];

  if (checkAnnihilation(state)) {
    state.phase = 'RESULT';
    return;
  }

  const phase: RtPhase = state.phase;
  const dropFromTeam = () => { state.proposedTeam = state.proposedTeam.filter(id => id !== playerId); };

  switch (phase) {
    case 'REVEAL':
      if (wasLeader) state.leaderId = nextAliveId(state, playerId);
      if (presentSeats(state).every(s => s.ready)) startPropose(state);
      break;
    case 'PROPOSE':
      if (wasLeader) state.leaderId = nextAliveId(state, playerId);
      startPropose(state);
      break;
    case 'TEAM_VOTE':
      if (wasLeader) {
        state.leaderId = nextAliveId(state, playerId);
        startPropose(state); // 隊長不見了，換下一位存活者重新組隊
        break;
      }
      dropFromTeam();
      if (state.proposedTeam.length === 0) startPropose(state);
      else if (allVoted(state)) resolveTeamVote(state);
      break;
    case 'QUEST':
      dropFromTeam();
      if (state.proposedTeam.length === 0) startPropose(state);
      else if (state.proposedTeam.every(id => state.questCards[id])) resolveQuest(state);
      break;
    case 'NIGHT': {
      const n = state.night;
      delete n.wolf.picks[playerId];
      for (const [wolf, target] of Object.entries(n.wolf.picks)) {
        if (target === playerId) delete n.wolf.picks[wolf];
      }
      if (n.kill) computeLock(n.wolf, aliveSeats(state).filter(s => isWolfRole(s.role)));
      checkNightAdvance(state);
      break;
    }
    case 'HUNTER':
      if (state.hunter && state.hunter.hunterId === playerId) state.hunter.resolved = true;
      break;
    case 'FINAL_HUNT': {
      if (!isSeerAlive(state)) {
        finish(state, 'GOOD', '預言家離開了，狼人已經沒有可以猜中的目標，好人獲勝！');
        state.phase = 'RESULT';
        break;
      }
      delete state.hunt.picks[playerId];
      for (const [wolf, target] of Object.entries(state.hunt.picks)) {
        if (target === playerId) delete state.hunt.picks[wolf];
      }
      const wolves = aliveSeats(state).filter(s => isWolfRole(s.role));
      computeLock(state.hunt, wolves);
      if (state.hunt.locked && state.hunt.target) resolveHunt(state, state.hunt.target);
      break;
    }
    default:
      break; // VOTE_RESULT／QUEST_RESULT／DAWN：進度不受影響，繼續時再檢查
  }
}

// ───────── 開局 ─────────

function startGame(room: RoundtableHostRoom): string | null {
  const state = room.gameState;
  const total = room.players.length;
  const rc = resolveRtConfig(state.config, total);
  const roles = resolveRtRoles(total, rc);
  if (!roles) return '神職太多了，超過好人名額（可以關掉守衛或獵人）';

  const dealt = shuffle<RtRole>([...roles.good, ...roles.evil]);
  const fresh = createInitialRtState(state.config);
  Object.assign(state, fresh);
  state.seats = room.players.map((p, i): RtSeat => ({
    playerId: p.id,
    role: dealt[i],
    team: isWolfRole(dealt[i]) ? 'EVIL' : 'GOOD',
    alive: true,
    deathRound: null,
    deathCause: null,
    left: false,
    ready: false
  }));
  state.quests = generateQuests(total).map(q => ({
    round: q.round,
    requiredPlayers: q.requiredPlayers,
    baseRequired: q.requiredPlayers,
    requiresTwoFails: q.requiresTwoFails,
    status: 'PENDING' as const,
    team: []
  }));
  state.leaderId = state.seats[Math.floor(Math.random() * state.seats.length)].playerId;
  state.phase = 'REVEAL';
  return null;
}

// ───────── 操作 ─────────

export function applyRoundtableAction(room: RoundtableHostRoom, playerId: string, input: RoundtableAction): RoundtableMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const mySeat = seatOf(state, playerId);
  const aliveMe = mySeat?.alive ? mySeat : undefined;
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });
  // 目標必須是存活者（或「不選」）
  const validTarget = (id: unknown, allowNone: boolean, allowSelf: boolean): id is string => {
    if (typeof id !== 'string') return false;
    if (id === RT_NONE) return allowNone;
    if (id === playerId && !allowSelf) return false;
    return !!seatOf(state, id)?.alive;
  };

  switch (input.action) {
    case 'UPDATE_CONFIG': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY') return { error: '對局進行中不能改設定' };
      const next = sanitizeConfig(state.config, input.config || {});
      if (!resolveRtRoles(room.players.length, resolveRtConfig(next, room.players.length))) {
        return { error: '神職加起來不能超過好人名額' };
      }
      state.config = next;
      break;
    }

    case 'START': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY' && state.phase !== 'RESULT') return { error: '對局已在進行中' };
      const total = room.players.length;
      if (total < RT_MIN_PLAYERS) return { error: `至少需要 ${RT_MIN_PLAYERS} 位玩家才能開始` };
      if (total > RT_MAX_PLAYERS) return { error: `最多 ${RT_MAX_PLAYERS} 位玩家` };
      const err = startGame(room);
      if (err) return { error: err };
      break;
    }

    case 'READY': {
      if (state.phase !== 'REVEAL' || !mySeat) return { room };
      mySeat.ready = true;
      if (presentSeats(state).every(s => s.ready)) startPropose(state);
      break;
    }

    case 'PROPOSE': {
      if (state.phase !== 'PROPOSE') return { error: '現在不是組隊時間' };
      if (state.leaderId !== playerId) return { error: '只有隊長可以選隊員' };
      const quest = state.quests[state.questIndex];
      const team = Array.isArray(input.team) ? input.team : [];
      if (new Set(team).size !== team.length) return { error: '隊員不能重複' };
      if (team.length !== quest.requiredPlayers) return { error: `這一輪需要剛好 ${quest.requiredPlayers} 位隊員` };
      if (!team.every(id => seatOf(state, id)?.alive)) return { error: '陣亡的人不能出任務' };
      state.proposedTeam = state.seats.map(s => s.playerId).filter(id => team.includes(id));
      state.votes = {};
      state.phase = 'TEAM_VOTE';
      break;
    }

    case 'VOTE': {
      if (state.phase !== 'TEAM_VOTE') return { error: '現在不是投票時間' };
      if (!mySeat || mySeat.left) return { error: '旁觀者不能投票' };
      state.votes[playerId] = !!input.approve; // 亡魂也可以投票
      if (allVoted(state)) resolveTeamVote(state);
      break;
    }

    case 'QUEST_CARD': {
      if (state.phase !== 'QUEST') return { error: '現在不是出任務時間' };
      if (!mySeat || !state.proposedTeam.includes(playerId)) return { error: '你不在這次任務的隊伍裡' };
      if (state.questCards[playerId]) return { error: '你已經交出任務牌了' };
      if (!input.success && mySeat.team === 'GOOD') return { error: '好人只能出成功牌' };
      state.questCards[playerId] = input.success ? 'SUCCESS' : 'FAIL';
      if (state.proposedTeam.every(id => state.questCards[id])) resolveQuest(state);
      break;
    }

    case 'WOLF_PICK': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || !isWolfRole(aliveMe.role)) return { error: '你不是存活的狼人' };
      if (!state.night.kill) return { error: '任務失敗的夜晚，狼人按兵不動' };
      if (!validTarget(input.targetId, true, true)) return { error: '請選擇存活的玩家' };
      state.night.wolf.picks[playerId] = input.targetId;
      computeLock(state.night.wolf, aliveSeats(state).filter(s => isWolfRole(s.role)));
      checkNightAdvance(state);
      break;
    }

    case 'SEER_CHECK': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || aliveMe.role !== 'SEER') return { error: '你不是預言家' };
      if (state.night.seerDone) return { error: '今晚已經查驗過了' };
      if (!validTarget(input.targetId, false, false)) return { error: '請選擇其他存活的玩家' };
      // 隱狼是壞人，但查驗會顯示好人
      const showsEvil = seatOf(state, input.targetId)!.role === 'WOLF';
      state.seerChecks.push({ round: state.night.round, targetId: input.targetId, showsEvil });
      pushEvent(state, { type: 'SEER', actorId: playerId, targetId: input.targetId, shownEvil: showsEvil }, state.night.round);
      state.night.seerDone = true;
      checkNightAdvance(state);
      break;
    }

    case 'GUARD': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || aliveMe.role !== 'GUARD') return { error: '你不是守衛' };
      if (!validTarget(input.targetId, false, true)) return { error: '請選擇存活的玩家' };
      if (input.targetId === state.lastGuardTarget) return { error: '不能連續兩晚守護同一個人' };
      state.night.guardSet = true;
      state.night.guardTarget = input.targetId;
      checkNightAdvance(state);
      break;
    }

    case 'REFLECT': {
      if (state.phase !== 'NIGHT') return { error: '現在不是夜晚行動時間' };
      if (!aliveMe || aliveMe.role === 'SEER' || aliveMe.role === 'GUARD') return { error: '你今晚不需要做夜間推理' };
      if (isWolfRole(aliveMe.role) && state.night.kill) return { error: '請和隊友選出刀口' };
      if (!validTarget(input.targetId, false, false)) return { error: '請選擇其他存活的玩家' };
      state.night.reflect[playerId] = input.targetId;
      state.suspicions = state.suspicions.filter(s => !(s.round === state.night.round && s.playerId === playerId));
      state.suspicions.push({ round: state.night.round, playerId, targetId: input.targetId });
      checkNightAdvance(state);
      break;
    }

    case 'HUNTER_SHOT': {
      const h = state.hunter;
      if (state.phase !== 'HUNTER' || !h || h.resolved) return { error: '現在不是獵人開槍時間' };
      if (h.hunterId !== playerId) return { error: '只有獵人可以開槍' };
      if (!validTarget(input.targetId, true, false)) return { error: '請選擇其他存活的玩家，或放棄開槍' };
      h.resolved = true;
      h.targetId = input.targetId === RT_NONE ? null : input.targetId;
      pushEvent(state, { type: 'HUNTER', actorId: playerId, targetId: h.targetId }, state.night.round);
      if (h.targetId) {
        killSeat(state, seatOf(state, h.targetId)!, 'HUNTER');
        pushEvent(state, { type: 'DEATH', targetId: h.targetId, cause: 'HUNTER' }, state.night.round);
      }
      break;
    }

    case 'HUNT_PICK': {
      if (state.phase !== 'FINAL_HUNT') return { error: '現在不是最後獵殺時間' };
      if (!aliveMe || !isWolfRole(aliveMe.role)) return { error: '只有存活的狼人可以選擇' };
      if (typeof input.targetId !== 'string' || !huntCandidates(state).includes(input.targetId)) {
        return { error: '請選擇一位存活的好人陣營玩家' };
      }
      state.hunt.picks[playerId] = input.targetId;
      computeLock(state.hunt, aliveSeats(state).filter(s => isWolfRole(s.role)));
      if (state.hunt.locked && state.hunt.target) resolveHunt(state, state.hunt.target);
      break;
    }

    case 'FORCE_RESOLVE': {
      if (!isHost) return hostOnly();
      if (state.phase === 'TEAM_VOTE') resolveTeamVote(state);
      else if (state.phase === 'QUEST') resolveQuest(state);
      else if (state.phase === 'NIGHT') {
        if (state.night.kill) forceLock(state.night.wolf, aliveSeats(state).filter(s => isWolfRole(s.role)), []);
        resolveNight(state);
      } else if (state.phase === 'FINAL_HUNT') {
        const cands = huntCandidates(state);
        const wolves = aliveSeats(state).filter(s => isWolfRole(s.role));
        forceLock(state.hunt, wolves, cands);
        // 多數票若不是合法目標（目標已離開）就改隨機
        const target = state.hunt.target && cands.includes(state.hunt.target)
          ? state.hunt.target
          : cands[Math.floor(Math.random() * cands.length)];
        if (target) resolveHunt(state, target);
      }
      break;
    }

    case 'CONTINUE': {
      if (state.phase === 'REVEAL') {
        if (!isHost) return hostOnly();
        startPropose(state); // 有人手機沒反應時，房主強制開始
      } else if (state.phase === 'VOTE_RESULT') {
        if (!isHost && state.leaderId !== playerId) return { error: '只有房主或隊長可以繼續' };
        const vote = state.lastVote!;
        if (state.winner) {
          state.phase = 'RESULT';
        } else if (vote.approved) {
          state.proposedTeam = state.proposedTeam.filter(id => seatOf(state, id)?.alive);
          if (state.proposedTeam.length === 0) startPropose(state);
          else {
            state.questCards = {};
            state.phase = 'QUEST';
          }
        } else {
          state.leaderId = nextAliveId(state, state.leaderId);
          startPropose(state);
        }
      } else if (state.phase === 'QUEST_RESULT') {
        if (!isHost && state.leaderId !== playerId) return { error: '只有房主或隊長可以繼續' };
        afterQuestResult(state);
      } else if (state.phase === 'DAWN' || state.phase === 'HUNTER') {
        if (!isHost) return hostOnly();
        proceedFromDawn(state);
      }
      break;
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      room.gameState = createInitialRtState(state.config);
      return { room };
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
      if (!room.players.some(p => p.id === input.targetId)) return { room };
      room.players = room.players.filter(p => p.id !== input.targetId);
      removeFromGame(state, input.targetId);
      break;
    }

    case 'LEAVE': {
      // 房主離開等於解散房間，由連線層處理
      if (isHost) return { error: '房主離開會解散房間' };
      room.players = room.players.filter(p => p.id !== playerId);
      removeFromGame(state, playerId);
      break;
    }

    default:
      return { error: '未知的操作指令' };
  }

  return { room };
}

// 新玩家加入或舊玩家重新連線；對局中才加入的人當旁觀者，下一局才有座位
export function addRoundtablePlayer(room: RoundtableHostRoom, player: { id: string; name: string; secret: string }): RoundtableMutation {
  return addPeerPlayer(room, player, RT_MAX_PLAYERS);
}

// ───────── 視角 ─────────

function buildNightView(state: RtState, mySeat: RtSeat | undefined): RtNightView | null {
  if (!mySeat || state.phase !== 'NIGHT') return null;
  const n = state.night;
  const base = { kill: n.kill, progress: nightProgress(state), myDone: isNightDone(state, mySeat) };
  if (!mySeat.alive) return { ...base, task: 'DEAD', myDone: true };

  switch (mySeat.role) {
    case 'GUARD':
      return { ...base, task: 'GUARD', guardTarget: n.guardSet ? n.guardTarget : null };
    case 'SEER':
      return { ...base, task: 'SEER' };
    case 'WOLF':
    case 'HIDDEN_WOLF': {
      if (!n.kill) return { ...base, task: 'REFLECT', reflectTarget: n.reflect[mySeat.playerId] ?? null };
      // 只給狼人看到存活狼隊友的選擇
      const picks: Record<string, string> = {};
      for (const s of aliveSeats(state)) {
        if (isWolfRole(s.role) && n.wolf.picks[s.playerId] !== undefined) picks[s.playerId] = n.wolf.picks[s.playerId];
      }
      return { ...base, task: 'WOLF', wolf: { picks, locked: n.wolf.locked } };
    }
    default:
      return { ...base, task: 'REFLECT', reflectTarget: n.reflect[mySeat.playerId] ?? null };
  }
}

function buildHuntView(state: RtState, mySeat: RtSeat | undefined): RtHuntView | null {
  if (state.phase !== 'FINAL_HUNT') return null;
  const wolfSide = !!mySeat && mySeat.team === 'EVIL';
  const picks: Record<string, string> = {};
  if (wolfSide) {
    for (const s of aliveSeats(state)) {
      if (isWolfRole(s.role) && state.hunt.picks[s.playerId] !== undefined) picks[s.playerId] = state.hunt.picks[s.playerId];
    }
  }
  return {
    isWolfSide: wolfSide,
    candidates: huntCandidates(state),
    canPick: wolfSide && !!mySeat?.alive,
    picks
  };
}

export function buildRoundtableView(room: RoundtableHostRoom, playerId: string, onlineIds: Set<string>): RoundtableRoomView {
  const state = room.gameState;
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '已離開的玩家';
  const phase = state.phase;
  const isOver = phase === 'RESULT';
  const mySeat = seatOf(state, playerId);
  const me = room.players.find(p => p.id === playerId);
  const config = resolveRtConfig(state.config, room.players.length);
  const revealOnDeath = state.config.revealOnDeath;

  const seats = state.seats.map(s => {
    const roleVisible = s.playerId === playerId || isOver || (revealOnDeath && !s.alive && !s.left);
    return {
      playerId: s.playerId,
      name: nameOf(s.playerId),
      alive: s.alive,
      left: s.left,
      deathRound: s.deathRound,
      ready: s.ready,
      hasVoted: phase === 'TEAM_VOTE' && s.playerId in state.votes,
      ...(roleVisible ? { role: s.role } : {})
    };
  });

  let result: RtResultInfo | null = null;
  if (isOver) {
    const stats = new Map<string, { hits: number; total: number }>();
    for (const sus of state.suspicions) {
      // 只有好人陣營的推理才計入最佳偵探
      if (seatOf(state, sus.playerId)?.team !== 'GOOD') continue;
      const st = stats.get(sus.playerId) || { hits: 0, total: 0 };
      st.total++;
      if (seatOf(state, sus.targetId)?.team === 'EVIL') st.hits++;
      stats.set(sus.playerId, st);
    }
    const top = Math.max(0, ...[...stats.values()].map(s => s.hits));
    result = {
      events: state.events,
      bestDetectives: top > 0
        ? [...stats.entries()].filter(([, s]) => s.hits === top).map(([id, s]) => ({ playerId: id, ...s }))
        : [],
      huntTargetId: state.huntTargetId,
      huntCorrect: state.huntTargetId ? seatOf(state, state.huntTargetId)?.role === 'SEER' : null
    };
  }

  let myPrivate: RtMySeat | null = null;
  if (mySeat) {
    myPrivate = { role: mySeat.role, team: mySeat.team, alive: mySeat.alive, ready: mySeat.ready };
    if (mySeat.team === 'EVIL') {
      myPrivate.mates = state.seats
        .filter(s => s.team === 'EVIL' && s.playerId !== playerId)
        .map(s => ({ playerId: s.playerId, role: s.role }));
    }
    if (mySeat.role === 'SEER') myPrivate.seerChecks = state.seerChecks;
    if (mySeat.role === 'GUARD') myPrivate.lastGuardTarget = state.lastGuardTarget;
  }

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) })),
    phase,
    config,
    seats,
    mySeat: myPrivate,
    quests: state.quests.map(q => ({
      round: q.round,
      requiredPlayers: q.requiredPlayers,
      requiresTwoFails: q.requiresTwoFails,
      status: q.status,
      successCount: q.successCount,
      failCount: q.failCount,
      team: q.team
    })),
    questIndex: state.questIndex,
    rejectCount: state.rejectCount,
    leaderId: state.leaderId,
    proposedTeam: state.proposedTeam,
    myVote: phase === 'TEAM_VOTE' && playerId in state.votes ? state.votes[playerId] : null,
    lastVote: state.lastVote,
    myQuestCard: phase === 'QUEST' ? state.questCards[playerId] ?? null : null,
    questSubmitted: phase === 'QUEST' ? Object.keys(state.questCards).length : 0,
    lastQuestFails: state.lastQuestFails,
    night: buildNightView(state, mySeat),
    dawn: phase === 'DAWN' || phase === 'HUNTER' ? state.dawn : null,
    hunter: phase === 'HUNTER' ? state.hunter : null, // 天亮宣告時不能先洩漏死者是獵人
    hunt: buildHuntView(state, mySeat),
    winner: state.winner,
    winReason: state.winReason,
    result
  };
}

export const roundtableEngine: PeerGameEngine<RoundtableHostRoom, RoundtableRoomView, RoundtableAction> = {
  codePrefix: 'RTW',
  storageKey: 'roundtable',
  createRoom: (id, host) => ({ id, hostId: host.id, version: 1, players: [host], gameState: createInitialRtState() }),
  addPlayer: addRoundtablePlayer,
  applyAction: applyRoundtableAction,
  buildView: buildRoundtableView
};
