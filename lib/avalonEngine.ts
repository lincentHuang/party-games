/**
 * 阿瓦隆 - 多手機房間版規則引擎（只在房主手機上執行）
 * 其他手機只送出「我要做什麼」，發角色、夜間視野、計票、任務結算、勝負全部由房主判定，
 * 每支手機只拿到自己看得到的資訊（buildAvalonView）。
 */

import { ALIGNMENT_COUNT_BY_PLAYERS, generateQuests } from '@/lib/avalonRules';
import { addPeerPlayer, shuffle } from '@/lib/peerRoom';
import { AvalonAlignment, AvalonRole } from '@/types/avalon';
import {
  AvalonAction,
  AvalonHostRoom,
  AvalonRoomConfig,
  AvalonRoomState,
  AvalonRoomView,
  AvalonSeat,
  AvalonVisionEntry
} from '@/types/avalonRoom';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';

export type AvalonMutation = PeerMutation<AvalonHostRoom>;

export const AVALON_MIN_PLAYERS = 5;
export const AVALON_MAX_PLAYERS = 10;
export const MAX_REJECTS = 5;

export function createInitialAvalonState(config?: AvalonRoomConfig): AvalonRoomState {
  return {
    phase: 'LOBBY',
    config: config ?? {
      usePercival: true,
      useMorgana: true,
      useMordred: false,
      useOberon: false,
      useLady: null
    },
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
    ladyEnabled: false,
    ladyHolderId: null,
    ladyHolders: [],
    ladyChecks: [],
    ladyChecked: false,
    assassinTargetId: null,
    winner: null,
    winReason: '',
    lastNotice: null
  };
}

export function effectiveLady(config: AvalonRoomConfig, playerCount: number): boolean {
  return config.useLady ?? playerCount >= 7;
}

// 依人數與設定決定這局的角色牌組；特殊壞人超過名額時 刺客 > 莫甘娜 > 莫德雷德 > 奧伯倫
export function resolveRoles(playerCount: number, config: AvalonRoomConfig): { good: AvalonRole[]; evil: AvalonRole[] } {
  const count = ALIGNMENT_COUNT_BY_PLAYERS[playerCount] || ALIGNMENT_COUNT_BY_PLAYERS[5];

  const good: AvalonRole[] = ['MERLIN'];
  if (config.usePercival && good.length < count.good) good.push('PERCIVAL');
  while (good.length < count.good) good.push('SERVANT');

  const evil: AvalonRole[] = ['ASSASSIN'];
  const wanted: [boolean, AvalonRole][] = [
    [config.useMorgana, 'MORGANA'],
    [config.useMordred, 'MORDRED'],
    [config.useOberon, 'OBERON']
  ];
  for (const [on, role] of wanted) {
    if (on && evil.length < count.evil) evil.push(role);
  }
  while (evil.length < count.evil) evil.push('MINION');

  return { good, evil };
}

function sanitizeConfig(current: AvalonRoomConfig, patch: Partial<AvalonRoomConfig>): AvalonRoomConfig {
  const next = { ...current };
  if (typeof patch.usePercival === 'boolean') next.usePercival = patch.usePercival;
  if (typeof patch.useMorgana === 'boolean') next.useMorgana = patch.useMorgana;
  if (typeof patch.useMordred === 'boolean') next.useMordred = patch.useMordred;
  if (typeof patch.useOberon === 'boolean') next.useOberon = patch.useOberon;
  if (typeof patch.useLady === 'boolean' || patch.useLady === null) next.useLady = patch.useLady;
  return next;
}

function nextSeatId(state: AvalonRoomState, fromId: string | null): string {
  const n = state.seats.length;
  const from = state.seats.findIndex(s => s.playerId === fromId);
  return state.seats[(from + 1 + n) % n].playerId;
}

function prevSeatId(state: AvalonRoomState, fromId: string): string {
  const n = state.seats.length;
  const from = state.seats.findIndex(s => s.playerId === fromId);
  return state.seats[(from - 1 + n) % n].playerId;
}

function startPropose(state: AvalonRoomState) {
  state.phase = 'PROPOSE';
  state.proposedTeam = [];
  state.votes = {};
  state.questCards = {};
}

function startNextRound(state: AvalonRoomState) {
  state.questIndex += 1;
  state.leaderId = nextSeatId(state, state.leaderId);
  startPropose(state);
}

function finish(state: AvalonRoomState, winner: AvalonAlignment, reason: string) {
  state.winner = winner;
  state.winReason = reason;
}

function allReady(state: AvalonRoomState): boolean {
  return state.seats.every(s => s.ready);
}

// 開票；沒投的視為贊成（只有房主強制開票時會發生）
function resolveTeamVote(state: AvalonRoomState) {
  const votes: Record<string, boolean> = {};
  for (const seat of state.seats) votes[seat.playerId] = state.votes[seat.playerId] ?? true;
  const yes = Object.values(votes).filter(Boolean).length;
  const approved = yes > state.seats.length - yes;

  if (approved) {
    state.rejectCount = 0;
  } else {
    state.rejectCount += 1;
    if (state.rejectCount >= MAX_REJECTS) {
      finish(state, 'EVIL', `連續 ${MAX_REJECTS} 次組隊被否決，壞人直接獲勝！`);
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
function resolveQuest(state: AvalonRoomState) {
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

  const failedCount = state.quests.filter(q => q.status === 'FAILED').length;
  if (failedCount >= 3) finish(state, 'EVIL', '三次任務失敗，壞人獲勝！');
  state.phase = 'QUEST_RESULT';
}

// 任務結算後的下一步
function afterQuestResult(state: AvalonRoomState) {
  if (state.winner) {
    state.phase = 'RESULT';
    return;
  }
  const successCount = state.quests.filter(q => q.status === 'SUCCESS').length;
  if (successCount >= 3) {
    state.phase = 'ASSASSINATE';
    return;
  }
  // 湖中仙女：第 2、3、4 輪任務結束後
  if (state.ladyEnabled && [1, 2, 3].includes(state.questIndex) && state.ladyHolderId) {
    state.phase = 'LADY';
    state.ladyChecked = false;
    return;
  }
  startNextRound(state);
}

function abortToLobby(room: AvalonHostRoom, notice: string) {
  room.gameState = { ...createInitialAvalonState(room.gameState.config), lastNotice: notice };
}

function inGame(state: AvalonRoomState): boolean {
  return state.phase !== 'LOBBY' && state.phase !== 'RESULT';
}

function startGame(room: AvalonHostRoom) {
  const state = room.gameState;
  const total = room.players.length;
  const { good, evil } = resolveRoles(total, state.config);
  const dealt = shuffle<AvalonRole>([...good, ...evil]);
  const goodSet = new Set<AvalonRole>(good);

  state.seats = shuffle(room.players).map((p, i): AvalonSeat => ({
    playerId: p.id,
    role: dealt[i],
    alignment: goodSet.has(dealt[i]) ? 'GOOD' : 'EVIL',
    ready: false
  }));

  state.quests = generateQuests(total).map(q => ({ ...q, team: [] }));
  state.questIndex = 0;
  state.leaderId = state.seats[Math.floor(Math.random() * state.seats.length)].playerId;
  state.rejectCount = 0;
  state.proposedTeam = [];
  state.votes = {};
  state.lastVote = null;
  state.questCards = {};
  state.lastQuestFails = null;
  state.ladyEnabled = effectiveLady(state.config, total);
  state.ladyHolderId = state.ladyEnabled ? prevSeatId(state, state.leaderId) : null;
  state.ladyHolders = state.ladyHolderId ? [state.ladyHolderId] : [];
  state.ladyChecks = [];
  state.ladyChecked = false;
  state.assassinTargetId = null;
  state.winner = null;
  state.winReason = '';
  state.lastNotice = null;
  state.phase = 'REVEAL';
}

export function applyAvalonAction(room: AvalonHostRoom, playerId: string, input: AvalonAction): AvalonMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const mySeat = state.seats.find(s => s.playerId === playerId);
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '玩家';
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });

  switch (input.action) {
    case 'UPDATE_CONFIG': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY') return { error: '對局進行中不能改設定' };
      state.config = sanitizeConfig(state.config, input.config || {});
      break;
    }

    case 'START': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY' && state.phase !== 'RESULT') return { error: '對局已在進行中' };
      const total = room.players.length;
      if (total < AVALON_MIN_PLAYERS) return { error: `至少需要 ${AVALON_MIN_PLAYERS} 位玩家才能開始` };
      if (total > AVALON_MAX_PLAYERS) return { error: `最多 ${AVALON_MAX_PLAYERS} 位玩家` };
      startGame(room);
      break;
    }

    case 'READY': {
      if (state.phase !== 'REVEAL' || !mySeat) return { room };
      mySeat.ready = true;
      if (allReady(state)) startPropose(state);
      break;
    }

    case 'PROPOSE': {
      if (state.phase !== 'PROPOSE') return { error: '現在不是組隊時間' };
      if (state.leaderId !== playerId) return { error: '只有隊長可以選隊員' };
      const quest = state.quests[state.questIndex];
      const team = Array.isArray(input.team) ? input.team : [];
      if (new Set(team).size !== team.length) return { error: '隊員不能重複' };
      if (team.length !== quest.requiredPlayers) return { error: `這一輪需要剛好 ${quest.requiredPlayers} 位隊員` };
      if (!team.every(id => state.seats.some(s => s.playerId === id))) return { error: '隊員名單有不在這局的玩家' };
      state.proposedTeam = state.seats.map(s => s.playerId).filter(id => team.includes(id));
      state.votes = {};
      state.phase = 'TEAM_VOTE';
      break;
    }

    case 'VOTE': {
      if (state.phase !== 'TEAM_VOTE') return { error: '現在不是投票時間' };
      if (!mySeat) return { error: '旁觀者不能投票' };
      state.votes[playerId] = !!input.approve;
      if (state.seats.every(s => s.playerId in state.votes)) resolveTeamVote(state);
      break;
    }

    case 'QUEST_CARD': {
      if (state.phase !== 'QUEST') return { error: '現在不是出任務時間' };
      if (!mySeat || !state.proposedTeam.includes(playerId)) return { error: '你不在這次任務的隊伍裡' };
      if (state.questCards[playerId]) return { error: '你已經交出任務牌了' };
      if (!input.success && mySeat.alignment === 'GOOD') return { error: '好人只能出成功牌' };
      state.questCards[playerId] = input.success ? 'SUCCESS' : 'FAIL';
      if (state.proposedTeam.every(id => state.questCards[id])) resolveQuest(state);
      break;
    }

    case 'FORCE_RESOLVE': {
      if (!isHost) return hostOnly();
      if (state.phase === 'TEAM_VOTE') resolveTeamVote(state);
      else if (state.phase === 'QUEST') resolveQuest(state);
      break;
    }

    case 'LADY_CHECK': {
      if (state.phase !== 'LADY') return { error: '現在不是湖中仙女時間' };
      if (state.ladyHolderId !== playerId) return { error: '只有仙女持有者可以查驗' };
      if (state.ladyChecked) return { error: '這次已經查驗過了' };
      const target = state.seats.find(s => s.playerId === input.targetId);
      if (!target) return { error: '找不到這位玩家' };
      if (state.ladyHolders.includes(target.playerId)) return { error: '不能查驗曾經持有仙女的人（含自己）' };
      state.ladyChecks.push({ holderId: playerId, targetId: target.playerId, alignment: target.alignment });
      state.ladyChecked = true;
      break;
    }

    case 'LADY_DONE': {
      if (state.phase !== 'LADY') return { room };
      if (state.ladyHolderId !== playerId && !isHost) return { error: '只有仙女持有者或房主可以繼續' };
      if (!state.ladyChecked && !isHost) return { error: '請先查驗一位玩家' };
      if (state.ladyChecked) {
        const last = state.ladyChecks[state.ladyChecks.length - 1];
        state.ladyHolderId = last.targetId;
        state.ladyHolders.push(last.targetId);
      }
      startNextRound(state);
      break;
    }

    case 'ASSASSINATE': {
      if (state.phase !== 'ASSASSINATE') return { error: '現在不是刺殺時間' };
      if (mySeat?.role !== 'ASSASSIN') return { error: '只有刺客可以刺殺' };
      const target = state.seats.find(s => s.playerId === input.targetId);
      if (!target || target.playerId === playerId) return { error: '請選擇另一位玩家' };
      state.assassinTargetId = target.playerId;
      if (target.role === 'MERLIN') finish(state, 'EVIL', `刺客刺中了梅林（${nameOf(target.playerId)}），壞人逆轉獲勝！`);
      else finish(state, 'GOOD', `刺客刺錯了人（${nameOf(target.playerId)}不是梅林），好人守住勝利！`);
      state.phase = 'RESULT';
      break;
    }

    case 'CONTINUE': {
      if (state.phase === 'REVEAL') {
        if (!isHost) return hostOnly();
        startPropose(state); // 有人手機沒反應時，房主強制開始
      } else if (state.phase === 'VOTE_RESULT') {
        if (!isHost && state.leaderId !== playerId) return { error: '只有房主或隊長可以繼續' };
        const vote = state.lastVote!;
        if (state.winner) state.phase = 'RESULT';
        else if (vote.approved) {
          state.questCards = {};
          state.phase = 'QUEST';
        } else {
          state.leaderId = nextSeatId(state, state.leaderId);
          startPropose(state);
        }
      } else if (state.phase === 'QUEST_RESULT') {
        if (!isHost && state.leaderId !== playerId) return { error: '只有房主或隊長可以繼續' };
        afterQuestResult(state);
      }
      break;
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      if (state.phase === 'LOBBY') return { room };
      room.gameState = {
        ...createInitialAvalonState(state.config),
        lastNotice: state.phase === 'RESULT' ? null : '房主結束了這一局'
      };
      return { room };
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
      const target = room.players.find(p => p.id === input.targetId);
      if (!target) return { room };
      const wasSeated = state.seats.some(s => s.playerId === target.id);
      room.players = room.players.filter(p => p.id !== target.id);
      if (inGame(state) && wasSeated) abortToLobby(room, `${target.name} 被房主移出房間，本局中止`);
      break;
    }

    case 'LEAVE': {
      // 房主離開等於解散房間，由連線層處理
      if (isHost) return { error: '房主離開會解散房間' };
      const me = room.players.find(p => p.id === playerId);
      room.players = room.players.filter(p => p.id !== playerId);
      if (inGame(state) && mySeat) abortToLobby(room, `${me?.name || '有玩家'} 離開了房間，本局中止`);
      break;
    }

    default:
      return { error: '未知的操作指令' };
  }

  return { room };
}

// 新玩家加入或舊玩家重新連線；對局中才加入的人當旁觀者，下一局才有座位
export function addAvalonPlayer(room: AvalonHostRoom, player: { id: string; name: string; secret: string }): AvalonMutation {
  return addPeerPlayer(room, player, AVALON_MAX_PLAYERS);
}

// 夜間視野：只算這位玩家自己看得到的人
function buildVision(state: AvalonRoomState, me: AvalonSeat, nameOf: (id: string) => string): AvalonVisionEntry[] {
  const entry = (s: AvalonSeat, label: string): AvalonVisionEntry => ({ playerId: s.playerId, name: nameOf(s.playerId), label });
  const others = state.seats.filter(s => s.playerId !== me.playerId);

  switch (me.role) {
    case 'MERLIN':
      return others.filter(s => s.alignment === 'EVIL' && s.role !== 'MORDRED').map(s => entry(s, '壞人'));
    case 'PERCIVAL':
      return others.filter(s => s.role === 'MERLIN' || s.role === 'MORGANA').map(s => entry(s, '梅林或莫甘娜'));
    case 'ASSASSIN':
    case 'MORGANA':
    case 'MORDRED':
    case 'MINION':
      return others.filter(s => s.alignment === 'EVIL' && s.role !== 'OBERON').map(s => entry(s, '壞人同伴'));
    default:
      return []; // 忠臣、奧伯倫什麼都看不到
  }
}

export function buildAvalonView(room: AvalonHostRoom, playerId: string, onlineIds: Set<string>): AvalonRoomView {
  const state = room.gameState;
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '已離開的玩家';
  const isOver = state.phase === 'RESULT';
  const mySeat = state.seats.find(s => s.playerId === playerId);
  const me = room.players.find(p => p.id === playerId);

  const ladyCandidates = state.phase === 'LADY'
    ? state.seats.map(s => s.playerId).filter(id => !state.ladyHolders.includes(id))
    : [];

  const showEvilTeam = state.phase === 'ASSASSINATE' && mySeat?.alignment === 'EVIL';

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) })),
    phase: state.phase,
    config: { ...state.config, useLady: effectiveLady(state.config, room.players.length) },
    lastNotice: state.lastNotice,
    seats: state.seats.map(s => ({
      playerId: s.playerId,
      name: nameOf(s.playerId),
      ready: s.ready,
      hasVoted: s.playerId in state.votes,
      ...(isOver ? { role: s.role } : {})
    })),
    mySeat: mySeat
      ? { role: mySeat.role, alignment: mySeat.alignment, ready: mySeat.ready, vision: buildVision(state, mySeat, nameOf) }
      : null,
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
    myVote: state.phase === 'TEAM_VOTE' && playerId in state.votes ? state.votes[playerId] : null,
    lastVote: state.lastVote,
    myQuestCard: state.phase === 'QUEST' ? state.questCards[playerId] ?? null : null,
    questSubmitted: state.phase === 'QUEST' ? Object.keys(state.questCards).length : 0,
    lastQuestFails: state.lastQuestFails,
    lady: {
      enabled: state.ladyEnabled,
      holderId: state.ladyHolderId,
      holders: state.ladyHolders,
      history: state.ladyChecks.map(c => ({ holderId: c.holderId, targetId: c.targetId })),
      candidates: ladyCandidates,
      checkedThisRound: state.ladyChecked,
      myResults: state.ladyChecks
        .filter(c => c.holderId === playerId)
        .map(c => ({ targetId: c.targetId, alignment: c.alignment }))
    },
    evilTeam: showEvilTeam
      ? state.seats
          .filter(s => s.alignment === 'EVIL')
          .map(s => ({ playerId: s.playerId, name: nameOf(s.playerId), isAssassin: s.role === 'ASSASSIN' }))
      : null,
    assassinTargetId: isOver ? state.assassinTargetId : null,
    winner: state.winner,
    winReason: state.winReason
  };
}

export const avalonEngine: PeerGameEngine<AvalonHostRoom, AvalonRoomView, AvalonAction> = {
  codePrefix: 'AVA',
  storageKey: 'avalon',
  createRoom: (id, host) => ({ id, hostId: host.id, version: 1, players: [host], gameState: createInitialAvalonState() }),
  addPlayer: addAvalonPlayer,
  applyAction: applyAvalonAction,
  buildView: buildAvalonView
};
