/**
 * 月夜換牌（一夜狼人類）- 多手機房間版型別
 * 房主手機保存完整狀態（OneNightHostRoom），每支手機只收到自己看得到的視角（OneNightRoomView）
 */

import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type OneNightRole =
  | 'WOLF'
  | 'MINION'
  | 'SEER'
  | 'ROBBER'
  | 'TROUBLEMAKER'
  | 'DRUNK'
  | 'INSOMNIAC'
  | 'HUNTER'
  | 'VILLAGER';

// 勝方陣營：好人陣營 / 狼人陣營（含爪牙）
export type OneNightTeam = 'GOOD' | 'WOLF';

export type OneNightPhase = 'LOBBY' | 'REVEAL' | 'NIGHT' | 'DAY' | 'VOTE' | 'RESULT';

// 「不選任何人」的代號（強盜／搗蛋鬼選擇不行動、狼人不偷看）
export const NONE = 'NONE';

export const CENTER_COUNT = 3;

export interface OneNightConfig {
  auto: boolean; // true = 配置跟著人數走（房主手動調整後變 false）
  wolfCount: number; // 1–3
  minion: boolean;
  seer: boolean;
  robber: boolean;
  troublemaker: boolean;
  drunk: boolean;
  insomniac: boolean;
  hunter: boolean;
  dayMinutes: number; // 0 = 不限時；3 / 5 / 7
}

export interface OneNightSeat {
  playerId: string;
  initial: OneNightRole; // 發到手的初始牌
  current: OneNightRole; // 夜晚結算後的最終牌（結算前等於 initial）
  ready: boolean;
  done: boolean; // 夜晚是否已完成行動
}

// 玩家夜裡得知的資訊（只給本人）
export type OneNightIntel =
  | { kind: 'WOLF_MATES'; ids: string[] } // 狼人：其他狼隊友（空 = 只有你一隻）
  | { kind: 'MINION_SEES'; ids: string[] } // 爪牙：看到的狼人（空 = 狼都在中央）
  | { kind: 'PEEK_CENTER'; indices: number[]; roles: OneNightRole[] } // 落單狼人／預言家看中央牌
  | { kind: 'SEE_PLAYER'; targetId: string; role: OneNightRole } // 預言家看玩家
  | { kind: 'ROBBED'; targetId: string; role: OneNightRole } // 強盜：換來的新牌
  | { kind: 'SWAPPED'; aId: string; bId: string } // 搗蛋鬼：自己交換了誰（沒看牌）
  | { kind: 'DRUNK'; index: number } // 酒鬼：換了第幾張中央牌（沒看牌）
  | { kind: 'INSOMNIAC'; role: OneNightRole } // 失眠者：結算後看到的最後一張牌
  | { kind: 'GUESS'; targetId: string }; // 夜間猜測：你覺得誰是狼

// 結算後公開的夜晚紀錄
export type OneNightEvent =
  | { type: 'WOLF_PEEK'; actorId: string; index: number; role: OneNightRole }
  | { type: 'SEER_PLAYER'; actorId: string; targetId: string; role: OneNightRole }
  | { type: 'SEER_CENTER'; actorId: string; indices: number[]; roles: OneNightRole[] }
  | { type: 'ROBBER'; actorId: string; targetId: string | null }
  | { type: 'TROUBLEMAKER'; actorId: string; aId: string | null; bId: string | null }
  | { type: 'DRUNK'; actorId: string; index: number };

export interface OneNightGuess {
  playerId: string;
  targetId: string;
}

export interface OneNightOutcome {
  outIds: string[];
  tally: Record<string, number>; // 每位玩家得票數
  hunterShotId: string | null; // 獵人出局時被帶走的人
  hunterId: string | null;
  winner: OneNightTeam | null;
  winnerIds: string[]; // 真正贏的玩家
  reason: string;
}

export interface OneNightState {
  phase: OneNightPhase;
  config: OneNightConfig;
  notice: string | null; // 例如「有人離開，本局中止」
  seats: OneNightSeat[];
  center: OneNightRole[]; // 3 張中央牌（結算後為最終牌）
  initialCenter: OneNightRole[];
  intel: Record<string, OneNightIntel[]>; // playerId -> 夜晚得知的資訊
  // 夜晚行動（結算時依 強盜 → 搗蛋鬼 → 酒鬼 → 失眠者 順序處理）
  robberTarget: string | null;
  tmPair: [string, string] | null;
  drunkIndex: number | null;
  events: OneNightEvent[];
  guesses: OneNightGuess[];
  dayStartedAt: number;
  votes: Record<string, string>; // voterId -> targetId
  outcome: OneNightOutcome | null;
}

// 房主手機上的完整房間
export interface OneNightHostRoom extends PeerHostRoomBase {
  gameState: OneNightState;
}

export interface OneNightSeatView {
  playerId: string;
  name: string;
  ready: boolean;
  hasVoted: boolean;
}

export type OneNightTask =
  | 'WOLF_ACK' // 有狼隊友：看過後按確認
  | 'WOLF_PEEK' // 落單狼人：可偷看一張中央牌
  | 'MINION_ACK'
  | 'SEER'
  | 'ROBBER'
  | 'TROUBLEMAKER'
  | 'DRUNK'
  | 'INSOMNIAC'
  | 'GUESS';

export interface OneNightNightView {
  progress: { done: number; total: number };
  task: OneNightTask;
  myDone: boolean;
}

export interface OneNightResultRow {
  playerId: string;
  name: string;
  initial: OneNightRole;
  final: OneNightRole;
  voteFor: string | null;
  votesReceived: number;
  isOut: boolean;
  won: boolean;
}

export interface OneNightResultInfo {
  rows: OneNightResultRow[];
  initialCenter: OneNightRole[];
  finalCenter: OneNightRole[];
  events: OneNightEvent[];
  outcome: OneNightOutcome;
  // 最佳直覺：夜間猜測猜中「初始狼人」的人
  bestIntuition: { playerId: string; targetId: string }[];
  guessTotal: number;
}

export interface OneNightRoomView extends PeerViewBase {
  phase: OneNightPhase;
  config: OneNightConfig;
  notice: string | null;
  seats: OneNightSeatView[];
  mySeat: { initial: OneNightRole; ready: boolean } | null; // null = 旁觀者
  night: OneNightNightView | null;
  intel: OneNightIntel[]; // 我夜裡得知的資訊
  dayStartedAt: number;
  myVote: string | null;
  votedCount: number;
  result: OneNightResultInfo | null;
}

export type OneNightAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<OneNightConfig> }
  | { action: 'START' }
  | { action: 'READY' }
  | { action: 'NIGHT_ACK' } // 狼人（有隊友）／爪牙／失眠者 確認
  | { action: 'WOLF_PEEK'; index: number | null } // null = 不偷看
  | { action: 'SEER_PLAYER'; targetId: string }
  | { action: 'SEER_CENTER'; indices: [number, number] }
  | { action: 'ROBBER'; targetId: string } // NONE = 不換
  | { action: 'TROUBLEMAKER'; aId: string; bId: string } // 兩個 NONE = 不換
  | { action: 'DRUNK'; index: number }
  | { action: 'GUESS'; targetId: string }
  | { action: 'FORCE_NIGHT' }
  | { action: 'START_VOTE' }
  | { action: 'VOTE'; targetId: string }
  | { action: 'CLOSE_VOTE' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' }
  | { action: 'ADD_BOT' }; // 只有房主，由連線層處理，不會進規則引擎
