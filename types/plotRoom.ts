/**
 * 宮廷密謀（吹牛／質疑類身分牌）- 多手機房間版型別
 * 房主手機保存完整狀態（PlotHostRoom），每支手機只收到自己看得到的視角（PlotRoomView）
 */

import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type PlotRole = 'TAX' | 'ASSASSIN' | 'THIEF' | 'ENVOY' | 'GUARD';
export const PLOT_ROLES: PlotRole[] = ['TAX', 'ASSASSIN', 'THIEF', 'ENVOY', 'GUARD'];

export type PlotPhase = 'LOBBY' | 'TURN' | 'RESPOND' | 'LOSE_CARD' | 'EXCHANGE' | 'RESULT';

export type PlotActionKind = 'INCOME' | 'AID' | 'COUP' | 'TAX' | 'ASSASSINATE' | 'THIEF' | 'ENVOY';

export interface PlotCard {
  role: PlotRole;
  revealed: boolean;
}

export interface PlotSeat {
  playerId: string;
  name: string;
  coins: number;
  cards: PlotCard[]; // 固定兩張，revealed = 已翻開（失去）
  left: boolean;
}

// 失去一張牌之後要接著做什麼
export type PlotAfterLose =
  | 'RESPOND_AGAIN' // 質疑失敗：回到回應視窗（只剩阻擋）
  | 'CANCEL' // 行動取消、結束回合
  | 'RESOLVE' // 執行行動效果
  | 'END_TURN';

export interface PlotPending {
  kind: PlotActionKind;
  actorId: string;
  targetId: string | null;
  claim: PlotRole | null; // 行動宣稱的角色（收入、外援、政變沒有）
}

export interface PlotRespond {
  stage: 'ACTION' | 'BLOCK';
  challengeOpen: boolean; // ACTION 階段：宣稱是否還能被質疑
  passed: Record<string, true>;
  blockerId: string | null; // BLOCK 階段：阻擋者
  blockRole: PlotRole | null;
}

export interface PlotState {
  phase: PlotPhase;
  seats: PlotSeat[];
  deck: PlotRole[];
  turnId: string | null;
  turnNo: number;
  pending: PlotPending | null;
  respond: PlotRespond | null;
  lose: { playerId: string; after: PlotAfterLose } | null;
  exchange: { playerId: string; options: PlotRole[]; keepCount: number } | null;
  log: string[];
  winnerId: string | null;
}

export interface PlotHostRoom extends PeerHostRoomBase {
  gameState: PlotState;
}

export interface PlotSeatView {
  playerId: string;
  name: string;
  coins: number;
  cardsLeft: number; // 還沒翻開的暗牌數
  revealed: PlotRole[]; // 已公開翻開的牌
  alive: boolean;
  left: boolean;
  hand?: PlotCard[]; // 自己的牌，或對局結束後所有人的牌
}

export interface PlotRespondOptions {
  waiting: boolean; // 我還需要回應
  canChallenge: boolean;
  blockRoles: PlotRole[];
}

export interface PlotRespondView {
  stage: 'ACTION' | 'BLOCK';
  claimerId: string; // 被質疑／被放行的宣稱者（ACTION 階段是行動者，BLOCK 階段是阻擋者）
  claimRole: PlotRole | null; // 宣稱的角色（外援沒有）
  waitingIds: string[];
  mine: PlotRespondOptions;
}

export interface PlotRoomView extends PeerViewBase {
  phase: PlotPhase;
  turnNo: number;
  turnId: string | null;
  seats: PlotSeatView[];
  mySeatIn: boolean; // 我是否在這局有座位（false = 旁觀者）
  deckCount: number;
  pending: PlotPending | null;
  respond: PlotRespondView | null;
  loseId: string | null;
  exchangeOptions: PlotRole[] | null; // 只有正在換牌的人看得到
  exchangeKeepCount: number;
  exchangeId: string | null;
  log: string[];
  winnerId: string | null;
}

export type PlotAction =
  | { action: 'START' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'DO'; kind: PlotActionKind; targetId?: string }
  | { action: 'PASS' }
  | { action: 'CHALLENGE' }
  | { action: 'BLOCK'; role: PlotRole }
  | { action: 'LOSE_CARD'; index: number }
  | { action: 'EXCHANGE'; keep: number[] }
  | { action: 'FORCE' } // 房主強制推進卡住的階段
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' }
  | { action: 'ADD_BOT' }; // 只有房主，由連線層處理，不會進規則引擎
