/**
 * 第六張爆炸（同時出牌排列類）- 多手機房間版型別
 * 房主手機保存完整狀態（SixthHostRoom，含所有人手牌），每支手機只收到自己的視角（SixthRoomView）
 */

import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type SixthPhase = 'LOBBY' | 'PICK' | 'PICK_ROW' | 'HAND_END' | 'RESULT';

export const SIXTH_MIN_PLAYERS = 2;
export const SIXTH_MAX_PLAYERS = 10;
export const SIXTH_HAND_SIZE = 10; // 每手每人 10 張，也就是 10 輪
export const SIXTH_ROW_COUNT = 4; // 桌上 4 列
export const SIXTH_ROW_LIMIT = 5; // 每列最多 5 張，第 6 張要吃牌
export const SIXTH_LIMITS = [30, 50, 66] as const;
export const SIXTH_DEFAULT_LIMIT = 50;
export const SIXTH_NORMAL_DECK = 104;

// 一張牌的炸彈數（原創計分）：個位 0 → 3、個位 5 → 2、兩位數字相同 → 5、77 → 7、其他 1；同時符合取最大
export function bombsOf(card: number): number {
  let b = 1;
  if (card % 10 === 0) b = Math.max(b, 3);
  if (card % 10 === 5) b = Math.max(b, 2);
  if (card >= 11 && card <= 99 && card % 11 === 0) b = Math.max(b, 5);
  if (card === 77) b = Math.max(b, 7);
  return b;
}

export function rowBombs(row: number[]): number {
  return row.reduce((sum, c) => sum + bombsOf(c), 0);
}

// 必須整列吃掉時，炸彈最少的列（平手取張數少者）。回傳所有並列最佳的列索引，方便電腦加隨機
export function cheapestRows(rows: number[][]): number[] {
  const key = (r: number[]) => rowBombs(r) * 100 + r.length;
  const best = Math.min(...rows.map(key));
  return rows.map((r, i) => (key(r) === best ? i : -1)).filter(i => i >= 0);
}

// 這張牌會落在哪一列：最後一張比它小且差距最小；沒有則回傳 -1（必須自選一列吃掉）
export function targetRowOf(rows: number[][], card: number): number {
  let best = -1;
  let bestLast = -1;
  rows.forEach((r, i) => {
    const last = r[r.length - 1];
    if (last < card && last > bestLast) {
      best = i;
      bestLast = last;
    }
  });
  return best;
}

export interface SixthConfig {
  limit: number; // 任何人累計炸彈 ≥ 上限，整場結束
  expert: boolean; // 專家模式：牌數 = 人數×10+4，只用 1 到該數字
}

export interface SixthSeat {
  playerId: string;
  name: string;
  hand: number[];
  pick: number | null; // 本輪已選的牌（還在 hand 裡，揭曉時才移出）
  score: number; // 整場累計炸彈
  handBombs: number; // 本手炸彈
  taken: number[]; // 本手吃進來的牌
  left: boolean;
}

// 一張牌的擺放紀錄（前端依序逐張呈現）
export type PlacementKind = 'APPEND' | 'SIXTH' | 'CHOOSE';
export interface SixthPlacement {
  playerId: string;
  card: number;
  row: number;
  kind: PlacementKind; // APPEND 接在列尾；SIXTH 第 6 張吃掉整列；CHOOSE 比所有列尾都小，自選一列吃
  taken: number[]; // 吃掉的牌（APPEND 為空）
  bombs: number;
}

export interface SixthRoundLog {
  hand: number;
  round: number;
  startRows: number[][];
  events: SixthPlacement[];
}

export interface SixthState {
  phase: SixthPhase;
  config: SixthConfig;
  hand: number; // 第幾手
  round: number; // 第幾輪（1–10，打完 10 輪後算 11）
  seats: SixthSeat[];
  rows: number[][];
  dealt: number; // 本手發出的總牌數 = 人數×10+4
  discarded: number[]; // 中途離開者被移除的手牌
  pending: { playerId: string; card: number }[]; // 還沒擺放的牌（由小到大）；PICK_ROW 時第 0 張就是等待選列的牌
  roundLog: SixthRoundLog | null;
  winnerIds: string[];
}

export interface SixthHostRoom extends PeerHostRoomBase {
  gameState: SixthState;
}

export interface SixthSeatView {
  playerId: string;
  name: string;
  score: number;
  handBombs: number;
  handCount: number;
  submitted: boolean;
  left: boolean;
  taken: number[];
}

export interface SixthMySeat {
  hand: number[];
  pick: number | null;
}

export interface SixthRoomView extends PeerViewBase {
  phase: SixthPhase;
  config: SixthConfig;
  hand: number;
  round: number;
  seats: SixthSeatView[];
  mySeat: SixthMySeat | null; // null = 旁觀者
  rows: number[][];
  roundLog: SixthRoundLog | null;
  pendingTake: { playerId: string; card: number } | null; // PICK_ROW 時等待選列的人與牌
  winnerIds: string[];
}

export type SixthAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<SixthConfig> }
  | { action: 'START' }
  | { action: 'PICK'; card: number }
  | { action: 'PICK_ROW'; row: number }
  | { action: 'FORCE_PICK' } // 房主：沒反應的人由系統隨機代選並揭曉
  | { action: 'FORCE_ROW' } // 房主：代選炸彈最少的列
  | { action: 'NEXT_HAND' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' }
  | { action: 'ADD_BOT' }; // 只有房主，由連線層處理，不會進規則引擎
