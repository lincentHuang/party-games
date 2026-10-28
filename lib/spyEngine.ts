/**
 * 誰是間諜 - 多手機房間版規則引擎（只在房主手機上執行）
 * 其他手機只送出「我要做什麼」，發詞、輪流發言、計票、勝負全部由房主判定，
 * 每支手機只拿到自己看得到的資訊（buildSpyView）。
 */

import { DEFAULT_WORD_PAIRS } from '@/lib/wordsData';
import { Difficulty, Role, VictoryStatus, WordPair } from '@/types/game';
import { SpyAction, SpyHostRoom, SpyRoomConfig, SpyRoomState, SpyRoomView, SpySeat } from '@/types/spyRoom';

export type SpyMutation = { room: SpyHostRoom } | { error: string };

export const SPY_MIN_PLAYERS = 3;
export const SPY_MAX_PLAYERS = 12;
const BLANK_WORD = '無（你是白板特工，請靠推理偽裝）';
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export function createInitialSpyState(): SpyRoomState {
  return {
    phase: 'LOBBY',
    config: {
      spyCount: 1,
      hasBlank: false,
      speechTime: 45,
      showRoleOnEliminated: true,
      difficulties: [...DIFFICULTIES],
      categories: ['all']
    },
    round: 1,
    seats: [],
    wordPair: null,
    speakQueue: [],
    speakIndex: 0,
    speakStartedAt: 0,
    roundStarterId: null,
    votes: {},
    candidates: [],
    voteAttempt: 0,
    lastElimination: null,
    winner: null,
    winReason: '',
    recentWords: []
  };
}

// 平民人數必須多於間諜，否則一開局就分出勝負
export function maxSpiesFor(playerCount: number, hasBlank: boolean): number {
  return Math.max(1, Math.floor((playerCount - (hasBlank ? 1 : 0) - 1) / 2));
}

export function checkVictory(seats: SpySeat[]): VictoryStatus {
  const alive = seats.filter(s => s.isAlive);
  const aliveSpies = alive.filter(s => s.role === 'SPY');
  const aliveCivilians = alive.filter(s => s.role === 'CIVILIAN');
  const aliveBlanks = alive.filter(s => s.role === 'BLANK');

  // 1. 間諜全數被淘汰 -> 平民獲勝
  if (aliveSpies.length === 0) {
    if (aliveBlanks.length > 0 && aliveCivilians.length === 0) {
      return { isGameOver: true, winner: 'BLANK', reason: '間諜全滅，白板特工成功偽裝到最後！' };
    }
    return { isGameOver: true, winner: 'CIVILIAN', reason: '所有間諜臥底均已被成功揪出！' };
  }

  // 2. 間諜存活人數 >= 平民存活人數 -> 間諜獲勝
  if (aliveSpies.length >= aliveCivilians.length) {
    return { isGameOver: true, winner: 'SPY', reason: '間諜存活人數已大於或等於平民，掌控特工局！' };
  }

  // 3. 僅剩白板與間諜各1人時
  if (alive.length === 2 && aliveSpies.length === 1 && aliveBlanks.length === 1) {
    return { isGameOver: true, winner: 'BLANK', reason: '白板特工成功生存至最終對決！' };
  }

  return { isGameOver: false, winner: null };
}

function sanitizeConfig(current: SpyRoomConfig, patch: Partial<SpyRoomConfig>): SpyRoomConfig {
  const next = { ...current };
  if (typeof patch.spyCount === 'number') next.spyCount = Math.min(Math.max(1, Math.floor(patch.spyCount)), 4);
  if (typeof patch.hasBlank === 'boolean') next.hasBlank = patch.hasBlank;
  if (typeof patch.speechTime === 'number') next.speechTime = Math.min(Math.max(0, Math.floor(patch.speechTime)), 300);
  if (typeof patch.showRoleOnEliminated === 'boolean') next.showRoleOnEliminated = patch.showRoleOnEliminated;
  if (Array.isArray(patch.difficulties)) {
    const picked = DIFFICULTIES.filter(d => patch.difficulties!.includes(d));
    next.difficulties = picked.length > 0 ? picked : [...DIFFICULTIES];
  }
  if (Array.isArray(patch.categories)) {
    const picked = patch.categories.filter(c => typeof c === 'string' && c.length <= 20).slice(0, 30);
    next.categories = picked.length > 0 ? picked : ['all'];
  }
  return next;
}

function sanitizeCustomWords(input: unknown): WordPair[] {
  if (!Array.isArray(input)) return [];
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 20) : '');
  return input.slice(0, 500).flatMap(item => {
    const civilian = clean(item?.civilian);
    const spy = clean(item?.spy);
    if (!civilian || !spy || civilian === spy) return [];
    return [{
      civilian,
      spy,
      difficulty: DIFFICULTIES.includes(item?.difficulty) ? item.difficulty : 'medium',
      category: clean(item?.category) || '自訂分類',
      isCustom: true
    }];
  });
}

function pickWordPair(state: SpyRoomState, customWords: WordPair[]): WordPair {
  const { difficulties, categories } = state.config;
  const all = [...DEFAULT_WORD_PAIRS, ...customWords];
  let pool = all.filter(w => difficulties.includes(w.difficulty || 'medium'));
  if (!categories.includes('all')) pool = pool.filter(w => categories.includes(w.category));
  if (pool.length === 0) pool = all;

  const fresh = pool.filter(w => !state.recentWords.includes(`${w.civilian}|${w.spy}`));
  const finalPool = fresh.length > 0 ? fresh : pool;
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

  state.recentWords = [...state.recentWords, `${chosen.civilian}|${chosen.spy}`].slice(-30);

  const swap = Math.random() < 0.5;
  return {
    civilian: swap ? chosen.spy : chosen.civilian,
    spy: swap ? chosen.civilian : chosen.spy,
    difficulty: chosen.difficulty || 'medium',
    category: chosen.category || '自訂分類',
    isCustom: !!chosen.isCustom
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 從 starterId 開始，依座位順序排出本輪存活者的發言順序
function beginRound(state: SpyRoomState, starterId: string) {
  const startIdx = Math.max(0, state.seats.findIndex(s => s.playerId === starterId));
  const ordered = [...state.seats.slice(startIdx), ...state.seats.slice(0, startIdx)];
  state.speakQueue = ordered.filter(s => s.isAlive).map(s => s.playerId);
  state.speakIndex = 0;
  state.speakStartedAt = Date.now();
  state.roundStarterId = state.speakQueue[0] ?? null;
  state.votes = {};
  state.candidates = [];
  state.voteAttempt = 0;
  state.phase = 'DESCRIBE';
}

function nextAliveAfter(state: SpyRoomState, playerId: string | null): string {
  const n = state.seats.length;
  const from = state.seats.findIndex(s => s.playerId === playerId);
  for (let step = 1; step <= n; step++) {
    const seat = state.seats[(from + step + n) % n];
    if (seat.isAlive) return seat.playerId;
  }
  return state.seats[0].playerId;
}

function beginVote(state: SpyRoomState, candidates: string[]) {
  state.phase = 'VOTE';
  state.votes = {};
  state.candidates = candidates;
}

// 跳過已出局／離開的人；全部講完就進投票
function advanceSpeaker(state: SpyRoomState) {
  const alive = new Set(state.seats.filter(s => s.isAlive).map(s => s.playerId));
  let idx = state.speakIndex + 1;
  while (idx < state.speakQueue.length && !alive.has(state.speakQueue[idx])) idx++;
  if (idx >= state.speakQueue.length) {
    beginVote(state, [...alive]);
  } else {
    state.speakIndex = idx;
    state.speakStartedAt = Date.now();
  }
}

function finishIfOver(state: SpyRoomState): boolean {
  const victory = checkVictory(state.seats);
  if (victory.isGameOver) {
    state.winner = victory.winner;
    state.winReason = victory.reason || '';
  }
  return victory.isGameOver;
}

function resolveVote(state: SpyRoomState) {
  const tally: Record<string, number> = {};
  for (const target of Object.values(state.votes)) {
    tally[target] = (tally[target] || 0) + 1;
  }
  const max = Math.max(0, ...Object.values(tally));
  const leaders = max > 0 ? Object.keys(tally).filter(id => tally[id] === max) : [];

  if (leaders.length === 1) {
    const seat = state.seats.find(s => s.playerId === leaders[0])!;
    seat.isAlive = false;
    seat.eliminatedRound = state.round;
    state.lastElimination = { round: state.round, playerId: seat.playerId, tally };
    finishIfOver(state);
    state.phase = 'ELIMINATED';
    return;
  }

  // 第一次平票：平票者 PK 重投；再平票就本輪無人出局
  if (leaders.length > 1 && state.voteAttempt === 0) {
    state.voteAttempt = 1;
    beginVote(state, leaders);
    return;
  }

  state.lastElimination = { round: state.round, playerId: null, tally };
  state.phase = 'ELIMINATED';
}

function allAliveVoted(state: SpyRoomState): boolean {
  return state.seats.filter(s => s.isAlive).every(s => state.votes[s.playerId]);
}

function allReady(state: SpyRoomState): boolean {
  return state.seats.filter(s => !s.left).every(s => s.ready);
}

// 玩家在對局中離開：視同出局，並修正發言／投票進度
function removeFromGame(state: SpyRoomState, playerId: string) {
  const seat = state.seats.find(s => s.playerId === playerId);
  if (!seat || state.phase === 'LOBBY' || state.phase === 'RESULT') return;

  const wasCurrentSpeaker = state.phase === 'DESCRIBE' && state.speakQueue[state.speakIndex] === playerId;
  seat.left = true;
  if (seat.isAlive) {
    seat.isAlive = false;
    seat.eliminatedRound = state.round;
  }
  delete state.votes[playerId];
  for (const [voter, target] of Object.entries(state.votes)) {
    if (target === playerId) delete state.votes[voter];
  }

  if (finishIfOver(state)) {
    state.phase = 'RESULT';
    return;
  }

  if (state.phase === 'REVEAL' && allReady(state)) beginRound(state, state.roundStarterId!);
  if (wasCurrentSpeaker) advanceSpeaker(state);
  if (state.phase === 'VOTE') {
    state.candidates = state.candidates.filter(id => id !== playerId);
    if (state.candidates.length < 2) beginVote(state, state.seats.filter(s => s.isAlive).map(s => s.playerId));
    else if (allAliveVoted(state)) resolveVote(state);
  }
}

export function applySpyAction(room: SpyHostRoom, playerId: string, input: SpyAction): SpyMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const mySeat = state.seats.find(s => s.playerId === playerId);
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });

  switch (input.action) {
    case 'UPDATE_CONFIG': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY' && state.phase !== 'RESULT') return { error: '對局進行中不能改設定' };
      state.config = sanitizeConfig(state.config, input.config || {});
      break;
    }

    case 'START': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'LOBBY' && state.phase !== 'RESULT') return { error: '對局已在進行中' };
      const total = room.players.length;
      if (total < SPY_MIN_PLAYERS) return { error: `至少需要 ${SPY_MIN_PLAYERS} 位玩家才能開始` };
      const { hasBlank } = state.config;
      const spyCount = Math.min(state.config.spyCount, maxSpiesFor(total, hasBlank));
      state.config.spyCount = spyCount;

      const wordPair = pickWordPair(state, sanitizeCustomWords(input.customWords));
      const roles: Role[] = [];
      for (let i = 0; i < spyCount; i++) roles.push('SPY');
      if (hasBlank) roles.push('BLANK');
      while (roles.length < total) roles.push('CIVILIAN');
      const dealt = shuffle(roles);

      state.seats = room.players.map((p, i) => ({
        playerId: p.id,
        role: dealt[i],
        word: dealt[i] === 'SPY' ? wordPair.spy : dealt[i] === 'BLANK' ? BLANK_WORD : wordPair.civilian,
        isAlive: true,
        eliminatedRound: null,
        left: false,
        ready: false
      }));
      state.wordPair = wordPair;
      state.round = 1;
      state.lastElimination = null;
      state.winner = null;
      state.winReason = '';
      state.speakQueue = [];
      state.votes = {};
      state.candidates = [];
      state.voteAttempt = 0;
      // 隨機挑第一位發言者
      state.roundStarterId = state.seats[Math.floor(Math.random() * state.seats.length)].playerId;
      state.phase = 'REVEAL';
      break;
    }

    case 'READY': {
      if (state.phase !== 'REVEAL' || !mySeat) return { room };
      mySeat.ready = true;
      if (allReady(state)) beginRound(state, state.roundStarterId!);
      break;
    }

    case 'NEXT_SPEAKER': {
      if (state.phase !== 'DESCRIBE') return { room };
      const speakerId = state.speakQueue[state.speakIndex];
      if (speakerId !== playerId && !isHost) return { error: '只有正在發言的人或房主可以換下一位' };
      advanceSpeaker(state);
      break;
    }

    case 'VOTE': {
      if (state.phase !== 'VOTE') return { error: '現在不是投票時間' };
      if (!mySeat?.isAlive) return { error: '出局的玩家不能投票' };
      if (input.targetId === playerId) return { error: '不能投給自己' };
      if (!state.candidates.includes(input.targetId)) return { error: '這位玩家不在投票名單中' };
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
        // 房主強制開始（有人手機沒反應時）
        beginRound(state, state.roundStarterId!);
      } else if (state.phase === 'ELIMINATED') {
        if (state.winner) {
          state.phase = 'RESULT';
        } else {
          state.round += 1;
          beginRound(state, nextAliveAfter(state, state.roundStarterId));
        }
      }
      break;
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      const fresh = createInitialSpyState();
      room.gameState = { ...fresh, config: state.config, recentWords: state.recentWords };
      return { room };
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
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
export function addSpyPlayer(room: SpyHostRoom, player: { id: string; name: string; secret: string }): SpyMutation {
  const existing = room.players.find(p => p.id === player.id);
  if (existing) {
    if (existing.secret !== player.secret) return { error: '玩家身分驗證失敗' };
    if (player.name) existing.name = player.name;
    return { room };
  }
  if (room.players.length >= SPY_MAX_PLAYERS) return { error: '房間已滿員！' };
  room.players.push({ id: player.id, name: player.name || `玩家 ${room.players.length + 1}`, isHost: false, secret: player.secret });
  return { room };
}

export function buildSpyView(room: SpyHostRoom, playerId: string, onlineIds: Set<string>): SpyRoomView {
  const state = room.gameState;
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name || '已離開的玩家';
  const isOver = state.phase === 'RESULT';
  const mySeat = state.seats.find(s => s.playerId === playerId);
  const me = room.players.find(p => p.id === playerId);

  const eliminatedSeat = state.lastElimination?.playerId
    ? state.seats.find(s => s.playerId === state.lastElimination!.playerId)
    : undefined;

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) })),
    phase: state.phase,
    config: state.config,
    round: state.round,
    seats: state.seats.map(s => {
      const roleVisible = isOver || (state.config.showRoleOnEliminated && !s.isAlive && !s.left);
      return {
        playerId: s.playerId,
        name: nameOf(s.playerId),
        isAlive: s.isAlive,
        eliminatedRound: s.eliminatedRound,
        left: s.left,
        ready: s.ready,
        hasVoted: !!state.votes[s.playerId],
        ...(roleVisible ? { role: s.role } : {}),
        ...(isOver ? { word: s.word } : {})
      };
    }),
    mySeat: mySeat ? { word: mySeat.word, isAlive: mySeat.isAlive, ready: mySeat.ready } : null,
    wordInfo: state.wordPair ? { category: state.wordPair.category, difficulty: state.wordPair.difficulty } : null,
    speakQueue: state.speakQueue,
    speakIndex: state.speakIndex,
    speakStartedAt: state.speakStartedAt,
    candidates: state.candidates,
    myVote: state.votes[playerId] || null,
    voteAttempt: state.voteAttempt,
    lastElimination: state.lastElimination
      ? {
          ...state.lastElimination,
          ...(eliminatedSeat && (isOver || state.config.showRoleOnEliminated) ? { role: eliminatedSeat.role } : {})
        }
      : null,
    winner: state.winner,
    winReason: state.winReason,
    wordPair: isOver ? state.wordPair : null
  };
}
