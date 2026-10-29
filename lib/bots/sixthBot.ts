/**
 * 第六張爆炸電腦玩家：只依自己的視角（SixthRoomView）決定下一步，不偷看別人的手牌。
 * 出牌：估算每張牌放下後「被迫吃牌」的期望炸彈數，挑最低的（再加一點隨機）；
 * 必須吃列時挑炸彈最少的列。房主專屬操作（START／NEXT_HAND／FORCE_*）交給真人房主。
 * 這個檔案只 import 型別與純函式，避免和規則引擎循環引用。
 */

import {
  bombsOf,
  cheapestRows,
  rowBombs,
  SIXTH_NORMAL_DECK,
  SIXTH_ROW_LIMIT,
  SixthAction,
  SixthRoomView,
  targetRowOf
} from '@/types/sixthRoom';

// P(K ≥ m)，K ~ Poisson(λ)
function poissonTail(lambda: number, m: number): number {
  if (m <= 0) return 1;
  let term = Math.exp(-lambda);
  let cdf = term;
  for (let i = 1; i < m; i++) {
    term *= lambda / i;
    cdf += term;
  }
  return Math.max(0, 1 - cdf);
}

// 每張手牌的「期望吃到的炸彈數」，越低越安全
export function sixthCardCosts(view: SixthRoomView): { card: number; cost: number }[] {
  const my = view.mySeat;
  if (!my) return [];
  const rows = view.rows;
  const activeOthers = Math.max(1, view.seats.filter(s => !s.left && s.playerId !== view.me.id).length);
  const deckMax = view.config.expert ? view.seats.length * 10 + 4 : SIXTH_NORMAL_DECK;

  // 已經看得到的牌：桌面、自己手牌、本手所有人吃掉的牌
  const seen = new Set<number>();
  rows.forEach(r => r.forEach(c => seen.add(c)));
  my.hand.forEach(c => seen.add(c));
  view.seats.forEach(s => s.taken.forEach(c => seen.add(c)));
  const unseenTotal = Math.max(1, deckMax - seen.size);
  // 每張沒看過的牌，這輪被別人打出來的機率
  const pPlayed = Math.min(1, activeOthers / unseenTotal);

  return my.hand.map(card => {
    const idx = targetRowOf(rows, card);
    let cost: number;
    if (idx < 0) {
      // 比所有列尾都小：一定要吃一列，吃最便宜的
      cost = Math.min(...rows.map(rowBombs)) + 0.5;
    } else {
      const row = rows[idx];
      const last = row[row.length - 1];
      let gapUnseen = 0;
      for (let c = last + 1; c < card; c++) if (!seen.has(c)) gapUnseen++;
      // 在我之前還會有多少張別人的牌落進這一列
      const lambda = gapUnseen * pPlayed;
      cost = rowBombs(row) * poissonTail(lambda, SIXTH_ROW_LIMIT - row.length);
      // 我自己的牌也算一張：列越長，之後越容易被別人觸發
      cost += 0.05 * row.length;
    }
    // 一點隨機性，避免永遠出同樣的牌；也稍微偏好先出大牌（低牌更容易變成沒列可放）
    cost = cost * (1 + Math.random() * 0.25) + Math.random() * 0.3;
    return { card, cost };
  });
}

export function sixthBotAction(view: SixthRoomView): SixthAction | null {
  const my = view.mySeat;
  if (!my) return null;

  if (view.phase === 'PICK_ROW') {
    if (view.pendingTake?.playerId !== view.me.id) return null;
    const options = cheapestRows(view.rows);
    return { action: 'PICK_ROW', row: options[Math.floor(Math.random() * options.length)] };
  }

  if (view.phase === 'PICK') {
    if (my.pick !== null || my.hand.length === 0) return null;
    const costs = sixthCardCosts(view).sort((a, b) => a.cost - b.cost);
    return { action: 'PICK', card: costs[0].card };
  }

  return null;
}

export { bombsOf };
