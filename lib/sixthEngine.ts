/**
 * 第六張爆炸 - 多手機房間版規則引擎（只在房主手機上執行）
 * 發牌、同時出牌、由小到大擺放、吃列計炸彈、結算全部由這裡處理。
 * 引擎沒有計時器，只被「操作」驅動：全員送出後立刻算完整輪並記錄每張牌的擺放（roundLog），
 * 前端再用 setTimeout 逐張呈現；需要自選列時停在 PICK_ROW，房主可 FORCE_ROW／FORCE_PICK 強制推進。
 */

import { addPeerPlayer, onlinePlayers, shuffle } from '@/lib/peerRoom';
import { sixthBotAction } from '@/lib/bots/sixthBot';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';
import {
  bombsOf,
  cheapestRows,
  rowBombs,
  SIXTH_DEFAULT_LIMIT,
  SIXTH_HAND_SIZE,
  SIXTH_LIMITS,
  SIXTH_MAX_PLAYERS,
  SIXTH_MIN_PLAYERS,
  SIXTH_NORMAL_DECK,
  SIXTH_ROW_COUNT,
  SIXTH_ROW_LIMIT,
  SixthAction,
  SixthConfig,
  SixthHostRoom,
  SixthRoomView,
  SixthSeat,
  SixthState,
  targetRowOf
} from '@/types/sixthRoom';

export type SixthMutation = PeerMutation<SixthHostRoom>;

export { SIXTH_MIN_PLAYERS, SIXTH_MAX_PLAYERS };

export function createInitialSixthState(config?: SixthConfig): SixthState {
  return {
    phase: 'LOBBY',
    config: config ?? { limit: SIXTH_DEFAULT_LIMIT, expert: false },
    hand: 0,
    round: 1,
    seats: [],
    rows: [],
    dealt: 0,
    discarded: [],
    pending: [],
    roundLog: null,
    winnerIds: []
  };
}

function sanitizeConfig(current: SixthConfig, patch: Partial<SixthConfig>): SixthConfig {
  const next = { ...current };
  if (typeof patch.limit === 'number' && (SIXTH_LIMITS as readonly number[]).includes(patch.limit)) next.limit = patch.limit;
  if (typeof patch.expert === 'boolean') next.expert = patch.expert;
  return next;
}

const seatOf = (state: SixthState, id: string | undefined) => state.seats.find(s => s.playerId === id);
const activeSeats = (state: SixthState) => state.seats.filter(s => !s.left);

// ───────── 發牌 ─────────

function dealHand(state: SixthState) {
  // 已離開的人上一手的牌不再計入
  for (const s of state.seats) {
    if (s.left) {
      s.hand = [];
      s.taken = [];
      s.handBombs = 0;
      s.pick = null;
    }
  }
  const seats = activeSeats(state);
  const n = seats.length;
  const need = n * SIXTH_HAND_SIZE + SIXTH_ROW_COUNT;
  const total = state.config.expert ? need : SIXTH_NORMAL_DECK;
  const deck = shuffle(Array.from({ length: total }, (_, i) => i + 1)).slice(0, need);
  seats.forEach((seat, i) => {
    seat.hand = deck.slice(i * SIXTH_HAND_SIZE, (i + 1) * SIXTH_HAND_SIZE).sort((a, b) => a - b);
    seat.pick = null;
    seat.handBombs = 0;
    seat.taken = [];
  });
  state.rows = deck.slice(n * SIXTH_HAND_SIZE).sort((a, b) => a - b).map(c => [c]);
  state.dealt = need;
  state.discarded = [];
  state.pending = [];
  state.roundLog = null;
  state.hand += 1;
  state.round = 1;
  state.phase = 'PICK';
}

// ───────── 結算 ─────────

function finishGame(state: SixthState) {
  const active = activeSeats(state);
  state.phase = 'RESULT';
  state.pending = [];
  if (active.length === 0) {
    state.winnerIds = [];
    return;
  }
  const min = Math.min(...active.map(s => s.score));
  state.winnerIds = active.filter(s => s.score === min).map(s => s.playerId);
}

function endHand(state: SixthState) {
  state.pending = [];
  const active = activeSeats(state);
  if (active.length < SIXTH_MIN_PLAYERS || active.some(s => s.score >= state.config.limit)) {
    finishGame(state);
  } else {
    state.phase = 'HAND_END';
  }
}

function endRound(state: SixthState) {
  state.pending = [];
  state.round += 1;
  const active = activeSeats(state);
  if (active.every(s => s.hand.length === 0)) endHand(state);
  else state.phase = 'PICK';
}

// 玩家吃掉某一列，自己的牌成為新列首張
function takeRow(state: SixthState, seat: SixthSeat, rowIdx: number, card: number, kind: 'SIXTH' | 'CHOOSE') {
  const taken = state.rows[rowIdx];
  const bombs = rowBombs(taken);
  seat.taken.push(...taken);
  seat.handBombs += bombs;
  seat.score += bombs;
  state.rows[rowIdx] = [card];
  state.roundLog?.events.push({ playerId: seat.playerId, card, row: rowIdx, kind, taken: [...taken], bombs });
}

// 依序擺放待放的牌；遇到必須自選列就停在 PICK_ROW，全部放完就結束本輪
function continueResolve(state: SixthState) {
  while (state.pending.length > 0) {
    const cur = state.pending[0];
    const seat = seatOf(state, cur.playerId);
    if (!seat || seat.left) {
      state.discarded.push(cur.card);
      state.pending.shift();
      continue;
    }
    const idx = targetRowOf(state.rows, cur.card);
    if (idx < 0) {
      state.phase = 'PICK_ROW';
      return;
    }
    state.pending.shift();
    if (state.rows[idx].length >= SIXTH_ROW_LIMIT) {
      takeRow(state, seat, idx, cur.card, 'SIXTH');
    } else {
      state.rows[idx].push(cur.card);
      state.roundLog?.events.push({ playerId: seat.playerId, card: cur.card, row: idx, kind: 'APPEND', taken: [], bombs: 0 });
    }
  }
  endRound(state);
}

function allPicked(state: SixthState): boolean {
  const active = activeSeats(state);
  return active.length > 0 && active.every(s => s.pick !== null);
}

// 全員送出：把所有人的牌由小到大排好，開始逐張擺放
function resolveRound(state: SixthState) {
  const plays = activeSeats(state)
    .filter(s => s.pick !== null)
    .map(s => ({ playerId: s.playerId, card: s.pick as number }))
    .sort((a, b) => a.card - b.card);
  for (const seat of activeSeats(state)) {
    if (seat.pick !== null) seat.hand = seat.hand.filter(c => c !== seat.pick);
    seat.pick = null;
  }
  state.roundLog = { hand: state.hand, round: state.round, startRows: state.rows.map(r => [...r]), events: [] };
  state.pending = plays;
  continueResolve(state);
}

// ───────── 離開／移出 ─────────

// 玩家在對局中離開：移除他的手牌；若大家正等他就直接往下走
function removeFromGame(state: SixthState, playerId: string) {
  const seat = seatOf(state, playerId);
  if (!seat || state.phase === 'LOBBY') return;
  if (seat.left) return;
  seat.left = true;
  if (state.phase === 'RESULT') return;

  state.discarded.push(...seat.hand);
  seat.hand = [];
  seat.pick = null;

  if (activeSeats(state).length < SIXTH_MIN_PLAYERS) {
    finishGame(state);
    return;
  }

  switch (state.phase) {
    case 'PICK':
      if (allPicked(state)) resolveRound(state);
      break;
    case 'PICK_ROW':
      // 他的牌（含正在等他選列的那張）直接作廢，其餘照常往下放
      state.pending = state.pending.filter(p => {
        if (p.playerId !== playerId) return true;
        state.discarded.push(p.card);
        return false;
      });
      continueResolve(state);
      break;
    default:
      break;
  }
}

// ───────── 操作 ─────────

export function applySixthAction(room: SixthHostRoom, playerId: string, input: SixthAction): SixthMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const seat = seatOf(state, playerId);
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
      if (state.phase !== 'LOBBY') return { error: '遊戲已經開始了' };
      if (room.players.length < SIXTH_MIN_PLAYERS) return { error: `至少需要 ${SIXTH_MIN_PLAYERS} 位玩家` };
      if (room.players.length > SIXTH_MAX_PLAYERS) return { error: `最多 ${SIXTH_MAX_PLAYERS} 位玩家` };
      state.seats = room.players.map(p => ({
        playerId: p.id,
        name: p.name,
        hand: [],
        pick: null,
        score: 0,
        handBombs: 0,
        taken: [],
        left: false
      }));
      state.hand = 0;
      state.winnerIds = [];
      dealHand(state);
      break;
    }

    case 'PICK': {
      if (state.phase !== 'PICK') return { error: '現在不是出牌時間' };
      if (!seat || seat.left) return { error: '你是旁觀者，這局不能出牌' };
      if (typeof input.card !== 'number' || !seat.hand.includes(input.card)) return { error: '你沒有這張牌' };
      if (seat.pick === input.card) return { room };
      seat.pick = input.card;
      if (allPicked(state)) resolveRound(state);
      break;
    }

    case 'PICK_ROW': {
      if (state.phase !== 'PICK_ROW') return { error: '現在不需要選列' };
      const cur = state.pending[0];
      if (!cur || cur.playerId !== playerId) return { error: '還沒輪到你選列' };
      if (!Number.isInteger(input.row) || input.row < 0 || input.row >= state.rows.length) return { error: '沒有這一列' };
      state.pending.shift();
      takeRow(state, seat!, input.row, cur.card, 'CHOOSE');
      continueResolve(state);
      break;
    }

    case 'FORCE_PICK': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'PICK') return { room };
      for (const s of activeSeats(state)) {
        if (s.pick === null && s.hand.length > 0) s.pick = s.hand[Math.floor(Math.random() * s.hand.length)];
      }
      if (allPicked(state)) resolveRound(state);
      break;
    }

    case 'FORCE_ROW': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'PICK_ROW') return { room };
      const cur = state.pending[0];
      const takerSeat = seatOf(state, cur?.playerId);
      if (!cur || !takerSeat) return { room };
      const options = cheapestRows(state.rows);
      state.pending.shift();
      takeRow(state, takerSeat, options[Math.floor(Math.random() * options.length)], cur.card, 'CHOOSE');
      continueResolve(state);
      break;
    }

    case 'NEXT_HAND': {
      if (!isHost) return hostOnly();
      if (state.phase !== 'HAND_END') return { room };
      dealHand(state);
      break;
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      if (state.phase === 'LOBBY') return { room };
      room.gameState = createInitialSixthState(state.config);
      return { room };
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
      room.players = room.players.filter(p => p.id !== input.targetId);
      removeFromGame(state, input.targetId!);
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

// 新玩家加入或舊玩家重新連線；對局中才加入的人當旁觀者，回大廳後才有座位
export function addSixthPlayer(room: SixthHostRoom, player: { id: string; name: string; secret: string }): SixthMutation {
  return addPeerPlayer(room, player, SIXTH_MAX_PLAYERS);
}

// ───────── 視角 ─────────

export function buildSixthView(room: SixthHostRoom, playerId: string, onlineIds: Set<string>): SixthRoomView {
  const state = room.gameState;
  const me = room.players.find(p => p.id === playerId) ?? { id: playerId, name: '', isHost: false };
  const mySeat = seatOf(state, playerId);
  const inPick = state.phase === 'PICK';
  const cur = state.phase === 'PICK_ROW' ? state.pending[0] : undefined;

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: me.id, name: me.name, isHost: me.isHost },
    players: onlinePlayers(room, onlineIds),
    phase: state.phase,
    config: { ...state.config },
    hand: state.hand,
    round: Math.min(state.round, SIXTH_HAND_SIZE),
    seats: state.seats.map(s => ({
      playerId: s.playerId,
      name: room.players.find(p => p.id === s.playerId)?.name ?? s.name,
      score: s.score,
      handBombs: s.handBombs,
      handCount: s.hand.length,
      // 只公開「是否已出牌」，絕不洩漏選了哪張
      submitted: inPick && s.pick !== null,
      left: s.left,
      taken: [...s.taken]
    })),
    mySeat: mySeat && !mySeat.left ? { hand: [...mySeat.hand], pick: mySeat.pick } : null,
    rows: state.rows.map(r => [...r]),
    roundLog: state.roundLog ? structuredClone(state.roundLog) : null,
    pendingTake: cur ? { playerId: cur.playerId, card: cur.card } : null,
    winnerIds: [...state.winnerIds]
  };
}

export const sixthEngine: PeerGameEngine<SixthHostRoom, SixthRoomView, SixthAction> = {
  codePrefix: 'SIX',
  storageKey: 'sixth',
  createRoom: (id, host) => ({ id, hostId: host.id, version: 1, players: [host], gameState: createInitialSixthState() }),
  addPlayer: addSixthPlayer,
  applyAction: applySixthAction,
  buildView: buildSixthView,
  botAction: sixthBotAction
};

export { bombsOf };
