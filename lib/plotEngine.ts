/**
 * 宮廷密謀（吹牛／質疑類身分牌）- 多手機房間版規則引擎（只在房主手機上執行）
 * 發牌、行動、宣稱／質疑／阻擋、失去牌、密使換牌、勝負判定全部由這裡處理，
 * 每支手機只拿到自己有權看到的資訊（buildPlotView）。
 *
 * 引擎沒有計時器，只被「操作」驅動；有人一直不回應時，房主可以用 FORCE 強制推進。
 *
 * 規則取捨：
 * - 刺客的 3 金在宣告時就先付，不論之後被質疑（不管成功與否）或被阻擋都不退。
 * - 質疑失敗（被質疑者真有那張牌）後，行動仍可被阻擋；已經放行過的人不會再被問一次。
 * - 阻擋被質疑失敗（阻擋者沒牌）→ 阻擋無效，行動照常執行（刺殺目標會連續失去兩張）。
 */

import { addPeerPlayer, shuffle } from '@/lib/peerRoom';
import { plotBotAction } from '@/lib/bots/plotBot';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';
import {
  PLOT_ROLES,
  PlotAction,
  PlotActionKind,
  PlotAfterLose,
  PlotHostRoom,
  PlotRespondOptions,
  PlotRole,
  PlotRoomView,
  PlotSeat,
  PlotSeatView,
  PlotState
} from '@/types/plotRoom';

export type PlotMutation = PeerMutation<PlotHostRoom>;

export const PLOT_MIN_PLAYERS = 2;
export const PLOT_MAX_PLAYERS = 6;
export const PLOT_COPIES = 3; // 每種角色 3 張
export const PLOT_START_COINS = 2;
export const COUP_COST = 7;
export const ASSASSINATE_COST = 3;
export const FORCED_COUP_COINS = 10;

const ROLE_LABEL: Record<PlotRole, string> = {
  TAX: '💰稅務官',
  ASSASSIN: '🗡️刺客',
  THIEF: '🦹盜賊',
  ENVOY: '📜密使',
  GUARD: '🛡️護衛'
};

// 行動宣稱的角色
export function claimOf(kind: PlotActionKind): PlotRole | null {
  switch (kind) {
    case 'TAX': return 'TAX';
    case 'ASSASSINATE': return 'ASSASSIN';
    case 'THIEF': return 'THIEF';
    case 'ENVOY': return 'ENVOY';
    default: return null;
  }
}

// 可以宣稱什麼角色來阻擋這個行動
export function blockRolesFor(kind: PlotActionKind, isTarget: boolean): PlotRole[] {
  switch (kind) {
    case 'AID': return ['TAX'];
    case 'ASSASSINATE': return isTarget ? ['GUARD'] : [];
    case 'THIEF': return isTarget ? ['THIEF', 'ENVOY'] : [];
    default: return [];
  }
}

export function needsTarget(kind: PlotActionKind): boolean {
  return kind === 'COUP' || kind === 'ASSASSINATE' || kind === 'THIEF';
}

export function createInitialPlotState(): PlotState {
  return {
    phase: 'LOBBY',
    seats: [],
    deck: [],
    turnId: null,
    turnNo: 0,
    pending: null,
    respond: null,
    lose: null,
    exchange: null,
    log: [],
    winnerId: null
  };
}

// ───────── 小工具 ─────────

const seatOf = (state: PlotState, id: string | null | undefined) =>
  id ? state.seats.find(s => s.playerId === id) : undefined;
const hiddenCount = (seat: PlotSeat) => seat.cards.filter(c => !c.revealed).length;
const isAlive = (seat: PlotSeat) => !seat.left && hiddenCount(seat) > 0;
const aliveSeats = (state: PlotState) => state.seats.filter(isAlive);
const nameOf = (state: PlotState, id: string | null | undefined) => seatOf(state, id)?.name || '某人';

function pushLog(state: PlotState, text: string) {
  state.log.push(text);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

// 牌數統計（手牌＋牌庫＋換牌暫存）；測試用，守恆應該永遠是 15
export function countPlotCards(state: PlotState): number {
  const inHands = state.seats.reduce((sum, s) => sum + s.cards.length, 0);
  const drawn = state.exchange ? state.exchange.options.length - state.exchange.keepCount : 0;
  return inHands + state.deck.length + drawn;
}

// ───────── 勝負／回合 ─────────

function checkWin(state: PlotState): boolean {
  const alive = aliveSeats(state);
  if (state.phase === 'LOBBY' || state.phase === 'RESULT') return state.phase === 'RESULT';
  if (alive.length > 1) return false;
  state.phase = 'RESULT';
  state.winnerId = alive[0]?.playerId ?? null;
  state.pending = null;
  state.respond = null;
  state.lose = null;
  state.exchange = null;
  pushLog(state, alive[0] ? `🏆 ${alive[0].name} 是最後的存活者，獲得勝利！` : '所有人都出局了，沒有勝者');
  return true;
}

function nextTurn(state: PlotState) {
  const seats = state.seats;
  const start = Math.max(0, seats.findIndex(s => s.playerId === state.turnId));
  for (let i = 1; i <= seats.length; i++) {
    const s = seats[(start + i) % seats.length];
    if (isAlive(s)) {
      state.turnId = s.playerId;
      state.turnNo++;
      state.phase = 'TURN';
      return;
    }
  }
}

function endTurn(state: PlotState) {
  state.pending = null;
  state.respond = null;
  state.lose = null;
  state.exchange = null;
  if (checkWin(state)) return;
  nextTurn(state);
}

// ───────── 失去牌 ─────────

function revealCard(state: PlotState, seat: PlotSeat, index: number) {
  seat.cards[index].revealed = true;
  pushLog(state, `${seat.name} 失去了 ${ROLE_LABEL[seat.cards[index].role]}`);
  if (hiddenCount(seat) === 0) pushLog(state, `💀 ${seat.name} 被淘汰了`);
}

function startLose(state: PlotState, playerId: string, after: PlotAfterLose) {
  const seat = seatOf(state, playerId);
  const hidden = seat ? seat.cards.map((c, i) => (c.revealed ? -1 : i)).filter(i => i >= 0) : [];
  if (!seat || hidden.length === 0) {
    continueAfter(state, after);
  } else if (hidden.length === 1) {
    revealCard(state, seat, hidden[0]); // 只剩一張，不用選
    continueAfter(state, after);
  } else {
    state.lose = { playerId, after };
    state.phase = 'LOSE_CARD';
  }
}

function continueAfter(state: PlotState, after: PlotAfterLose) {
  state.lose = null;
  if (checkWin(state)) return;
  // 行動者本人已不在局內：整個行動作廢
  const pendingActor = state.pending ? seatOf(state, state.pending.actorId) : undefined;
  if (state.pending && (!pendingActor || !isAlive(pendingActor))) {
    endTurn(state);
    return;
  }
  switch (after) {
    case 'RESPOND_AGAIN':
      if (state.respond) {
        state.respond.challengeOpen = false;
        state.phase = 'RESPOND';
        advanceRespond(state);
      } else endTurn(state);
      break;
    case 'RESOLVE':
      resolveAction(state);
      break;
    default:
      endTurn(state);
  }
}

// ───────── 回應視窗 ─────────

// 某位玩家在目前的回應視窗可以做什麼
export function respondOptionsOf(state: PlotState, playerId: string): { canChallenge: boolean; blockRoles: PlotRole[] } {
  const r = state.respond;
  const p = state.pending;
  const seat = seatOf(state, playerId);
  if (!r || !p || !seat || !isAlive(seat)) return { canChallenge: false, blockRoles: [] };
  if (r.stage === 'ACTION') {
    if (playerId === p.actorId) return { canChallenge: false, blockRoles: [] };
    return { canChallenge: r.challengeOpen && !!p.claim, blockRoles: blockRolesFor(p.kind, playerId === p.targetId) };
  }
  if (playerId === r.blockerId) return { canChallenge: false, blockRoles: [] };
  return { canChallenge: true, blockRoles: [] };
}

function waitingIdsOf(state: PlotState): string[] {
  const r = state.respond;
  if (!r) return [];
  return aliveSeats(state)
    .filter(s => {
      if (r.passed[s.playerId]) return false;
      const o = respondOptionsOf(state, s.playerId);
      return o.canChallenge || o.blockRoles.length > 0;
    })
    .map(s => s.playerId);
}

// 所有人都回應完了：行動繼續，或阻擋成立
function advanceRespond(state: PlotState) {
  const r = state.respond;
  if (!r || state.phase !== 'RESPOND') return;
  if (waitingIdsOf(state).length > 0) return;
  if (r.stage === 'ACTION') {
    resolveAction(state);
  } else {
    pushLog(state, `🛡️ ${nameOf(state, r.blockerId)} 的阻擋成立，行動取消`);
    endTurn(state);
  }
}

function doChallenge(state: PlotState, challengerId: string) {
  const r = state.respond!;
  const p = state.pending!;
  const inAction = r.stage === 'ACTION';
  const claimerId = inAction ? p.actorId : r.blockerId!;
  const role = inAction ? p.claim! : r.blockRole!;
  const claimer = seatOf(state, claimerId)!;
  pushLog(state, `❗ ${nameOf(state, challengerId)} 質疑 ${claimer.name} 的 ${ROLE_LABEL[role]}`);
  const idx = claimer.cards.findIndex(c => !c.revealed && c.role === role);
  if (idx >= 0) {
    // 真有這張牌：亮出、洗回牌庫、補抽一張；質疑者失去一張牌
    pushLog(state, `✅ ${claimer.name} 亮出 ${ROLE_LABEL[role]}，質疑失敗（牌洗回牌庫並補抽一張）`);
    state.deck.push(role);
    state.deck = shuffle(state.deck);
    claimer.cards[idx].role = state.deck.pop()!;
    startLose(state, challengerId, inAction ? 'RESPOND_AGAIN' : 'END_TURN');
  } else {
    pushLog(state, `❌ ${claimer.name} 沒有 ${ROLE_LABEL[role]}，吹牛被識破`);
    startLose(state, claimerId, inAction ? 'END_TURN' : 'RESOLVE');
  }
}

function doBlock(state: PlotState, blockerId: string, role: PlotRole) {
  pushLog(state, `✋ ${nameOf(state, blockerId)} 宣稱 ${ROLE_LABEL[role]} 阻擋`);
  state.respond = { stage: 'BLOCK', challengeOpen: true, passed: {}, blockerId, blockRole: role };
  state.phase = 'RESPOND';
  advanceRespond(state);
}

// ───────── 行動效果 ─────────

function resolveAction(state: PlotState) {
  const p = state.pending;
  const actor = seatOf(state, p?.actorId);
  state.respond = null;
  if (!p || !actor || !isAlive(actor)) {
    endTurn(state);
    return;
  }
  const target = seatOf(state, p.targetId);
  switch (p.kind) {
    case 'AID':
      actor.coins += 2;
      pushLog(state, `💵 ${actor.name} 領到外援 +2 金`);
      endTurn(state);
      break;
    case 'TAX':
      actor.coins += 3;
      pushLog(state, `💰 ${actor.name} 收稅 +3 金`);
      endTurn(state);
      break;
    case 'THIEF': {
      if (target && isAlive(target)) {
        const take = Math.min(2, target.coins);
        target.coins -= take;
        actor.coins += take;
        pushLog(state, `🦹 ${actor.name} 從 ${target.name} 偷走 ${take} 金`);
      }
      endTurn(state);
      break;
    }
    case 'ASSASSINATE':
      if (target && isAlive(target)) {
        pushLog(state, `🗡️ 刺殺 ${target.name} 成功`);
        startLose(state, target.playerId, 'END_TURN');
      } else endTurn(state);
      break;
    case 'ENVOY': {
      const drawn: PlotRole[] = [];
      for (let i = 0; i < 2 && state.deck.length > 0; i++) drawn.push(state.deck.pop()!);
      const hand = actor.cards.filter(c => !c.revealed).map(c => c.role);
      state.exchange = { playerId: actor.playerId, options: [...hand, ...drawn], keepCount: hand.length };
      state.phase = 'EXCHANGE';
      pushLog(state, `📜 ${actor.name} 從牌庫抽牌換牌中`);
      break;
    }
    default:
      endTurn(state);
  }
}

// ───────── 離開／移出 ─────────

// 玩家在對局中離開：視同兩張牌都翻開淘汰，修正各階段
function removeFromGame(state: PlotState, playerId: string) {
  const seat = seatOf(state, playerId);
  if (!seat || state.phase === 'LOBBY' || state.phase === 'RESULT') return;
  if (isAlive(seat)) pushLog(state, `🚪 ${seat.name} 離開了遊戲（視同淘汰）`);
  seat.cards.forEach(c => { c.revealed = true; });
  seat.left = true;
  if (checkWin(state)) return;

  switch (state.phase) {
    case 'TURN':
      if (state.turnId === playerId) nextTurn(state);
      break;
    case 'RESPOND': {
      const p = state.pending;
      const r = state.respond;
      if (!p || !r) { endTurn(state); break; }
      if (p.actorId === playerId || (r.stage === 'ACTION' && p.targetId === playerId)) endTurn(state);
      else if (r.stage === 'BLOCK' && r.blockerId === playerId) resolveAction(state); // 阻擋者走了，阻擋作廢
      else advanceRespond(state);
      break;
    }
    case 'LOSE_CARD':
      if (state.lose?.playerId === playerId) continueAfter(state, state.lose.after);
      else if (state.pending?.actorId === playerId) endTurn(state);
      break;
    case 'EXCHANGE': {
      const ex = state.exchange;
      if (ex && ex.playerId === playerId) {
        state.deck.push(...ex.options.slice(ex.keepCount)); // 抽到的牌放回牌庫
        state.deck = shuffle(state.deck);
        state.exchange = null;
        endTurn(state);
      }
      break;
    }
  }
}

// ───────── 操作 ─────────

export function applyPlotAction(room: PlotHostRoom, playerId: string, input: PlotAction): PlotMutation {
  const state = room.gameState;
  const isHost = room.hostId === playerId;
  const mySeat = seatOf(state, playerId);
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });
  const isPlaying = state.phase !== 'LOBBY' && state.phase !== 'RESULT';

  switch (input.action) {
    case 'START': {
      if (!isHost) return hostOnly();
      if (isPlaying) return { error: '對局已在進行中' };
      const total = room.players.length;
      if (total < PLOT_MIN_PLAYERS) return { error: `至少需要 ${PLOT_MIN_PLAYERS} 位玩家才能開始` };
      if (total > PLOT_MAX_PLAYERS) return { error: `最多 ${PLOT_MAX_PLAYERS} 位玩家` };
      const deck: PlotRole[] = [];
      for (const role of PLOT_ROLES) for (let i = 0; i < PLOT_COPIES; i++) deck.push(role);
      const shuffled = shuffle(deck);
      const fresh = createInitialPlotState();
      fresh.deck = shuffled;
      fresh.seats = room.players.map(p => ({
        playerId: p.id,
        name: p.name,
        coins: PLOT_START_COINS,
        cards: [
          { role: fresh.deck.pop()!, revealed: false },
          { role: fresh.deck.pop()!, revealed: false }
        ],
        left: false
      }));
      fresh.turnId = shuffle(fresh.seats.map(s => s.playerId))[0];
      fresh.turnNo = 1;
      fresh.phase = 'TURN';
      pushLog(fresh, `🎴 對局開始，${nameOf(fresh, fresh.turnId)} 先手`);
      room.gameState = fresh;
      return { room };
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      room.gameState = createInitialPlotState();
      return { room };
    }

    case 'DO': {
      if (state.phase !== 'TURN') return { error: '現在不是行動時間' };
      if (!mySeat || state.turnId !== playerId || !isAlive(mySeat)) return { error: '還沒輪到你' };
      const kind = input.kind;
      if (mySeat.coins >= FORCED_COUP_COINS && kind !== 'COUP') return { error: `手上有 ${FORCED_COUP_COINS} 金以上，必須發動政變` };
      const target = seatOf(state, input.targetId);
      if (needsTarget(kind)) {
        if (!target || !isAlive(target) || target.playerId === playerId) return { error: '請選擇其他存活的玩家當目標' };
      }
      state.pending = { kind, actorId: playerId, targetId: needsTarget(kind) ? target!.playerId : null, claim: claimOf(kind) };
      switch (kind) {
        case 'INCOME':
          mySeat.coins += 1;
          pushLog(state, `🪙 ${mySeat.name} 收入 +1 金`);
          endTurn(state);
          break;
        case 'COUP':
          if (mySeat.coins < COUP_COST) { state.pending = null; return { error: `政變需要 ${COUP_COST} 金` }; }
          mySeat.coins -= COUP_COST;
          pushLog(state, `⚔️ ${mySeat.name} 付 ${COUP_COST} 金發動政變，指定 ${target!.name}`);
          startLose(state, target!.playerId, 'END_TURN');
          break;
        case 'AID':
        case 'TAX':
        case 'ASSASSINATE':
        case 'THIEF':
        case 'ENVOY':
          if (kind === 'ASSASSINATE') {
            if (mySeat.coins < ASSASSINATE_COST) { state.pending = null; return { error: `刺客需要 ${ASSASSINATE_COST} 金` }; }
            mySeat.coins -= ASSASSINATE_COST;
          }
          if (kind === 'THIEF' && target!.coins <= 0) { state.pending = null; return { error: '對方沒有金幣可以偷' }; }
          pushLog(state, describeDeclare(state, kind, mySeat.name, target?.name));
          state.respond = { stage: 'ACTION', challengeOpen: !!claimOf(kind), passed: {}, blockerId: null, blockRole: null };
          state.phase = 'RESPOND';
          advanceRespond(state);
          break;
        default:
          state.pending = null;
          return { error: '未知的行動' };
      }
      break;
    }

    case 'PASS':
    case 'CHALLENGE':
    case 'BLOCK': {
      if (state.phase !== 'RESPOND' || !state.respond) return { error: '現在不是回應時間' };
      const opts = respondOptionsOf(state, playerId);
      if (!mySeat || (!opts.canChallenge && opts.blockRoles.length === 0)) return { error: '你現在不需要回應' };
      if (state.respond.passed[playerId]) return { error: '你已經選過了' };
      if (input.action === 'PASS') {
        state.respond.passed[playerId] = true;
        advanceRespond(state);
      } else if (input.action === 'CHALLENGE') {
        if (!opts.canChallenge) return { error: '這個宣稱不能質疑' };
        doChallenge(state, playerId);
      } else {
        if (!opts.blockRoles.includes(input.role)) return { error: '你不能用這個角色阻擋' };
        doBlock(state, playerId, input.role);
      }
      break;
    }

    case 'LOSE_CARD': {
      if (state.phase !== 'LOSE_CARD' || !state.lose) return { error: '現在不用選牌' };
      if (state.lose.playerId !== playerId || !mySeat) return { error: '不是你要選牌' };
      const card = mySeat.cards[input.index];
      if (!card || card.revealed) return { error: '請選擇一張還沒翻開的牌' };
      const after = state.lose.after;
      revealCard(state, mySeat, input.index);
      continueAfter(state, after);
      break;
    }

    case 'EXCHANGE': {
      const ex = state.exchange;
      if (state.phase !== 'EXCHANGE' || !ex) return { error: '現在不是換牌時間' };
      if (ex.playerId !== playerId || !mySeat) return { error: '不是你在換牌' };
      const keep = Array.isArray(input.keep) ? input.keep : [];
      const unique = new Set(keep);
      if (keep.length !== ex.keepCount || unique.size !== keep.length || keep.some(i => !Number.isInteger(i) || i < 0 || i >= ex.options.length)) {
        return { error: `請選出 ${ex.keepCount} 張要留下的牌` };
      }
      const kept = keep.map(i => ex.options[i]);
      const returned = ex.options.filter((_, i) => !unique.has(i));
      state.deck.push(...returned);
      state.deck = shuffle(state.deck);
      let k = 0;
      for (const c of mySeat.cards) if (!c.revealed) c.role = kept[k++];
      pushLog(state, `📜 ${mySeat.name} 換好牌了`);
      endTurn(state);
      break;
    }

    case 'FORCE': {
      if (!isHost) return hostOnly();
      switch (state.phase) {
        case 'TURN': {
          const turn = seatOf(state, state.turnId);
          if (!turn) return { error: '找不到目前玩家' };
          if (turn.coins >= FORCED_COUP_COINS) {
            const victim = shuffle(aliveSeats(state).filter(s => s.playerId !== turn.playerId))[0];
            return applyPlotAction(room, turn.playerId, { action: 'DO', kind: 'COUP', targetId: victim?.playerId });
          }
          return applyPlotAction(room, turn.playerId, { action: 'DO', kind: 'INCOME' });
        }
        case 'RESPOND': {
          const r = state.respond;
          if (!r) return { room };
          for (const id of waitingIdsOf(state)) r.passed[id] = true;
          advanceRespond(state);
          break;
        }
        case 'LOSE_CARD': {
          const lose = state.lose;
          const seat = seatOf(state, lose?.playerId);
          if (!lose || !seat) return { room };
          const idx = shuffle(seat.cards.map((c, i) => (c.revealed ? -1 : i)).filter(i => i >= 0))[0];
          return applyPlotAction(room, lose.playerId, { action: 'LOSE_CARD', index: idx });
        }
        case 'EXCHANGE': {
          const ex = state.exchange;
          if (!ex) return { room };
          return applyPlotAction(room, ex.playerId, { action: 'EXCHANGE', keep: Array.from({ length: ex.keepCount }, (_, i) => i) });
        }
        default:
          return { error: '目前沒有需要強制推進的階段' };
      }
      break;
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

function describeDeclare(state: PlotState, kind: PlotActionKind, actor: string, target?: string): string {
  switch (kind) {
    case 'AID': return `💵 ${actor} 想領外援 +2 金`;
    case 'TAX': return `💰 ${actor} 宣稱 ${ROLE_LABEL.TAX}，收稅 +3 金`;
    case 'ASSASSINATE': return `🗡️ ${actor} 付 ${ASSASSINATE_COST} 金，宣稱 ${ROLE_LABEL.ASSASSIN} 刺殺 ${target}`;
    case 'THIEF': return `🦹 ${actor} 宣稱 ${ROLE_LABEL.THIEF}，向 ${target} 偷錢`;
    case 'ENVOY': return `📜 ${actor} 宣稱 ${ROLE_LABEL.ENVOY}，要換牌`;
    default: return actor;
  }
}

// 新玩家加入或舊玩家重新連線；對局中才加入的人當旁觀者，下一局才有座位
export function addPlotPlayer(room: PlotHostRoom, player: { id: string; name: string; secret: string }): PlotMutation {
  return addPeerPlayer(room, player, PLOT_MAX_PLAYERS);
}

// ───────── 視角 ─────────

export function buildPlotView(room: PlotHostRoom, playerId: string, onlineIds: Set<string>): PlotRoomView {
  const state = room.gameState;
  const me = room.players.find(p => p.id === playerId);
  const isOver = state.phase === 'RESULT';
  const mySeat = seatOf(state, playerId);

  const seats: PlotSeatView[] = state.seats.map(s => ({
    playerId: s.playerId,
    name: room.players.find(p => p.id === s.playerId)?.name || s.name,
    coins: s.coins,
    cardsLeft: hiddenCount(s),
    revealed: s.cards.filter(c => c.revealed).map(c => c.role),
    alive: isAlive(s),
    left: s.left,
    ...(s.playerId === playerId || isOver ? { hand: s.cards.map(c => ({ ...c })) } : {})
  }));

  let respond: PlotRoomView['respond'] = null;
  if (state.phase === 'RESPOND' && state.respond && state.pending) {
    const r = state.respond;
    const opts = respondOptionsOf(state, playerId);
    const waitingIds = waitingIdsOf(state);
    const mine: PlotRespondOptions = {
      waiting: waitingIds.includes(playerId),
      canChallenge: opts.canChallenge,
      blockRoles: opts.blockRoles
    };
    respond = {
      stage: r.stage,
      claimerId: r.stage === 'ACTION' ? state.pending.actorId : r.blockerId!,
      claimRole: r.stage === 'ACTION' ? state.pending.claim : r.blockRole,
      waitingIds,
      mine
    };
  }

  const ex = state.phase === 'EXCHANGE' ? state.exchange : null;
  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) })),
    phase: state.phase,
    turnNo: state.turnNo,
    turnId: state.turnId,
    seats,
    mySeatIn: !!mySeat,
    deckCount: state.deck.length,
    pending: state.phase === 'RESPOND' || state.phase === 'LOSE_CARD' || state.phase === 'EXCHANGE' ? state.pending : null,
    respond,
    loseId: state.phase === 'LOSE_CARD' ? state.lose?.playerId ?? null : null,
    exchangeOptions: ex && ex.playerId === playerId ? ex.options : null,
    exchangeKeepCount: ex?.keepCount ?? 0,
    exchangeId: ex?.playerId ?? null,
    log: state.log.slice(isOver ? -40 : -10),
    winnerId: state.winnerId
  };
}

export const plotEngine: PeerGameEngine<PlotHostRoom, PlotRoomView, PlotAction> = {
  codePrefix: 'PLT',
  storageKey: 'plot',
  createRoom: (id, host) => ({ id, hostId: host.id, version: 1, players: [host], gameState: createInitialPlotState() }),
  addPlayer: addPlotPlayer,
  applyAction: applyPlotAction,
  buildView: buildPlotView,
  botAction: plotBotAction
};
