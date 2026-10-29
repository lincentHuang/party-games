/**
 * 宮廷密謀電腦玩家：只依自己的視角（PlotRoomView）決定下一步，不偷看別人的暗牌。
 * 沒事可做就回傳 null；房主專屬操作（START／FORCE／KICK…）由真人房主負責。
 * 這個檔案只 import 型別，避免和規則引擎循環引用。
 */

import { PlotAction, PlotActionKind, PlotRole, PlotRoomView, PlotSeatView } from '@/types/plotRoom';

const COPIES = 3;
const TOTAL_CARDS = COPIES * 5;

// 牌的價值：失去時先丟低的，換牌時留高的
const KEEP_VALUE: Record<PlotRole, number> = { TAX: 4, ASSASSIN: 4, GUARD: 3.2, THIEF: 3, ENVOY: 2.2 };

const rand = () => Math.random();

function weightedPick<T>(items: { item: T; weight: number }[]): T | null {
  const valid = items.filter(i => i.weight > 0);
  const total = valid.reduce((sum, i) => sum + i.weight, 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const i of valid) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return valid[valid.length - 1].item;
}

interface Knowledge {
  hand: PlotRole[]; // 我還沒翻開的牌
  revealedOf: (role: PlotRole) => number;
  unseen: (role: PlotRole) => number; // 我看不到的那個角色還剩幾張
  unknownCards: number; // 我看不到的牌總數（牌庫＋別人的暗牌）
}

function knowledgeOf(view: PlotRoomView, my: PlotSeatView): Knowledge {
  const hand = (my.hand ?? []).filter(c => !c.revealed).map(c => c.role);
  const revealedAll = view.seats.flatMap(s => s.revealed);
  const revealedOf = (role: PlotRole) => revealedAll.filter(r => r === role).length;
  return {
    hand,
    revealedOf,
    unseen: role => Math.max(0, COPIES - revealedOf(role) - hand.filter(h => h === role).length),
    unknownCards: Math.max(1, TOTAL_CARDS - revealedAll.length - hand.length)
  };
}

// 這個人（還剩 k 張暗牌）手上至少有一張該角色的機率，再用「敢宣稱的人多半比較誠實」修正
function honestyProb(k: Knowledge, role: PlotRole, cardsLeft: number): number {
  const u = k.unseen(role);
  if (u === 0) return 0;
  const U = k.unknownCards;
  let has: number;
  if (cardsLeft <= 1 || U < 2) has = Math.min(1, u / U);
  else has = 1 - ((U - u) / U) * ((U - u - 1) / (U - 1));
  const bluffRate = 0.3;
  return has / (has + (1 - has) * bluffRate);
}

function pickTarget(view: PlotRoomView, meId: string, score: (s: PlotSeatView) => number, filter?: (s: PlotSeatView) => boolean): string | null {
  const others = view.seats.filter(s => s.alive && s.playerId !== meId && (!filter || filter(s)));
  if (others.length === 0) return null;
  const scored = others.map(s => ({ item: s.playerId, weight: Math.max(0.1, score(s)) + rand() }));
  return weightedPick(scored);
}

export function plotBotAction(view: PlotRoomView): PlotAction | null {
  const meId = view.me.id;
  const my = view.seats.find(s => s.playerId === meId);
  if (!my || !my.alive || !view.mySeatIn) return null;
  const k = knowledgeOf(view, my);

  switch (view.phase) {
    case 'TURN':
      return view.turnId === meId ? chooseTurn(view, my, k) : null;

    case 'RESPOND':
      return chooseRespond(view, my, k);

    case 'LOSE_CARD': {
      if (view.loseId !== meId || !my.hand) return null;
      // 丟價值最低的牌（略微加點隨機，避免太好猜）
      const candidates = my.hand
        .map((c, i) => ({ c, i }))
        .filter(x => !x.c.revealed)
        .sort((a, b) => KEEP_VALUE[a.c.role] + rand() * 0.6 - (KEEP_VALUE[b.c.role] + rand() * 0.6));
      return candidates.length > 0 ? { action: 'LOSE_CARD', index: candidates[0].i } : null;
    }

    case 'EXCHANGE': {
      if (view.exchangeId !== meId || !view.exchangeOptions) return null;
      const ranked = view.exchangeOptions
        .map((role, i) => ({ i, v: KEEP_VALUE[role] + rand() * 0.6 }))
        .sort((a, b) => b.v - a.v)
        .slice(0, view.exchangeKeepCount)
        .map(x => x.i);
      return { action: 'EXCHANGE', keep: ranked };
    }

    default:
      return null;
  }
}

function chooseTurn(view: PlotRoomView, my: PlotSeatView, k: Knowledge): PlotAction | null {
  const meId = my.playerId;
  const others = view.seats.filter(s => s.alive && s.playerId !== meId);
  if (others.length === 0) return null;
  const threat = (s: PlotSeatView) => s.coins * 0.6 + s.cardsLeft * 2;

  // 10 金以上一定要政變
  if (my.coins >= 10) {
    return { action: 'DO', kind: 'COUP', targetId: pickTarget(view, meId, threat)! };
  }

  // 可以宣稱的角色：有牌權重高，沒牌就吹牛（權重低，且不吹已經全部現身的角色）
  const claimWeight = (role: PlotRole, honest: number, bluff: number) => {
    if (k.hand.includes(role)) return honest;
    return k.unseen(role) === 0 ? 0 : bluff;
  };

  const richTarget = pickTarget(view, meId, s => s.coins, s => s.coins > 0);
  const options: { item: { kind: PlotActionKind; targetId?: string } | null; weight: number }[] = [
    { item: { kind: 'INCOME' }, weight: 1.3 },
    { item: { kind: 'AID' }, weight: 2 },
    { item: { kind: 'TAX' }, weight: claimWeight('TAX', 4, 1.2) },
    { item: { kind: 'ENVOY' }, weight: claimWeight('ENVOY', 2, 0.5) }
  ];
  if (richTarget) options.push({ item: { kind: 'THIEF', targetId: richTarget }, weight: claimWeight('THIEF', 3, 0.9) });
  if (my.coins >= 3) {
    options.push({ item: { kind: 'ASSASSINATE', targetId: pickTarget(view, meId, threat)! }, weight: claimWeight('ASSASSIN', 4.5, 1.1) });
  }
  if (my.coins >= 7) options.push({ item: { kind: 'COUP', targetId: pickTarget(view, meId, threat)! }, weight: 5 });

  const chosen = weightedPick(options);
  if (!chosen) return { action: 'DO', kind: 'INCOME' };
  return { action: 'DO', kind: chosen.kind, ...(chosen.targetId ? { targetId: chosen.targetId } : {}) };
}

function chooseRespond(view: PlotRoomView, my: PlotSeatView, k: Knowledge): PlotAction | null {
  const r = view.respond;
  const p = view.pending;
  if (!r || !p || !r.mine.waiting) return null;
  const meId = my.playerId;
  const claimerSeat = view.seats.find(s => s.playerId === r.claimerId);
  const lastCard = my.cardsLeft <= 1;

  // 質疑意願
  let challengeProb = 0;
  if (r.mine.canChallenge && r.claimRole && claimerSeat) {
    const honest = honestyProb(k, r.claimRole, claimerSeat.cardsLeft);
    if (k.unseen(r.claimRole) === 0) {
      challengeProb = 0.97; // 三張都現身了，對方一定在吹牛
    } else {
      challengeProb = (1 - honest) * 0.9;
      if (lastCard) challengeProb *= 0.55; // 只剩一張牌，輸了就出局，保守一點
      // 公開翻開越多張，剩下的越稀有，更容易質疑
      if (k.revealedOf(r.claimRole) >= 2) challengeProb = Math.max(challengeProb, 0.5);
    }
    // 我是刺殺目標：被打中就掉牌，質疑意願提高
    if (r.stage === 'ACTION' && p.kind === 'ASSASSINATE' && p.targetId === meId && !k.hand.includes('GUARD')) {
      challengeProb = Math.max(challengeProb, lastCard ? 0.4 : 0.25);
    }
    // 我是行動者，我的行動被阻擋：不甘心，多質疑一點
    if (r.stage === 'BLOCK' && p.actorId === meId) challengeProb = Math.min(0.95, challengeProb * 1.4 + 0.1);
    // 別人的阻擋與我無關時，不必多管閒事
    if (r.stage === 'BLOCK' && p.actorId !== meId) challengeProb *= 0.5;
    // 與我無關的收稅／換牌：少管閒事
    if (r.stage === 'ACTION' && p.targetId !== meId && (p.kind === 'TAX' || p.kind === 'ENVOY')) challengeProb *= 0.6;
  }
  if (challengeProb > 0 && rand() < challengeProb) return { action: 'CHALLENGE' };

  // 阻擋
  if (r.mine.blockRoles.length > 0) {
    const holds = r.mine.blockRoles.filter(role => k.hand.includes(role));
    if (holds.length > 0) {
      const sureBlock = p.kind === 'ASSASSINATE' ? 0.95 : p.kind === 'THIEF' ? 0.7 : 0.8;
      if (rand() < sureBlock) return { action: 'BLOCK', role: holds[Math.floor(rand() * holds.length)] };
    } else {
      // 沒牌也敢擋（吹牛）：被刺殺且只剩一張牌時賭一把
      const bluffable = r.mine.blockRoles.filter(role => k.unseen(role) > 0);
      let bluffProb = 0.06;
      if (p.kind === 'ASSASSINATE') bluffProb = lastCard ? 0.6 : 0.2;
      if (p.kind === 'THIEF') bluffProb = my.coins >= 2 ? 0.15 : 0.03;
      if (bluffable.length > 0 && rand() < bluffProb) return { action: 'BLOCK', role: bluffable[Math.floor(rand() * bluffable.length)] };
    }
  }
  return { action: 'PASS' };
}
