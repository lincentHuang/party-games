/**
 * 圓桌狼人（阿瓦隆 + 狼人殺融合版）- 多手機房間版型別
 * 房主手機保存完整狀態（RoundtableHostRoom，含所有人的角色、秘密票、夜晚行動），
 * 每支手機只拿到 buildRoundtableView 算出的自己視角（RoundtableRoomView）。
 */

import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type RtRole = 'SEER' | 'GUARD' | 'HUNTER' | 'KNIGHT' | 'WOLF' | 'HIDDEN_WOLF';
export type RtTeam = 'GOOD' | 'EVIL';

export type RtPhase =
  | 'LOBBY'
  | 'REVEAL'        // 按住看身分
  | 'PROPOSE'       // 隊長挑隊員
  | 'TEAM_VOTE'     // 全員秘密表決（含亡魂）
  | 'VOTE_RESULT'   // 公開每個人的票
  | 'QUEST'         // 隊員秘密出任務牌
  | 'QUEST_RESULT'  // 公開成功／失敗張數
  | 'NIGHT'         // 夜晚同步行動
  | 'DAWN'          // 天亮宣告
  | 'HUNTER'        // 獵人開槍
  | 'FINAL_HUNT'    // 最後獵殺（狼人猜預言家）
  | 'RESULT';

// 「不選任何人」的代號（空刀、獵人放棄）
export const RT_NONE = 'NONE';

// 房主設定；null = 依人數自動
export interface RtConfig {
  guard: boolean | null;
  hunter: boolean | null;
  hiddenWolf: boolean | null;
  revealOnDeath: boolean;
}

// 已換算成實際值
export interface RtResolvedConfig {
  guard: boolean;
  hunter: boolean;
  hiddenWolf: boolean;
  revealOnDeath: boolean;
}

export type RtDeathCause = 'WOLF' | 'HUNTER' | 'LEAVE';

export interface RtSeat {
  playerId: string;
  role: RtRole;
  team: RtTeam;
  alive: boolean;
  deathRound: number | null;
  deathCause: RtDeathCause | null;
  left: boolean;
  ready: boolean;
}

export interface RtQuestRecord {
  round: number;
  requiredPlayers: number; // 實際需要人數（存活不足時會縮減）
  baseRequired: number;    // 規則表上的人數
  requiresTwoFails: boolean;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  successCount?: number;
  failCount?: number;
  team: string[];
}

export type RtCard = 'SUCCESS' | 'FAIL';

export interface RtVoteSnapshot {
  round: number;
  leaderId: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
  rejectCount: number;
}

// 狼人同步選刀口／最後獵殺的選擇狀態
export interface RtWolfPick {
  picks: Record<string, string>; // wolfId -> targetId | RT_NONE
  locked: boolean;
  target: string | null;
}

export interface RtNightState {
  round: number;
  kill: boolean; // 本輪任務成功 -> 狼人才能殺人
  wolf: RtWolfPick;
  guardSet: boolean;
  guardTarget: string | null;
  seerDone: boolean;
  reflect: Record<string, string>;
}

export interface RtEvent {
  round: number;
  type: 'KILL' | 'NO_KILL' | 'GUARD' | 'SEER' | 'DEATH' | 'HUNTER' | 'LEAVE';
  actorId?: string;
  targetId?: string | null; // null = 空刀／放棄
  shownEvil?: boolean;      // SEER：查驗顯示的結果
  cause?: RtDeathCause;
}

export interface RtSeerCheck {
  round: number;
  targetId: string;
  showsEvil: boolean; // 隱狼會顯示 false
}

export interface RtSuspicion {
  round: number;
  playerId: string;
  targetId: string;
}

export interface RtHunterState {
  hunterId: string;
  resolved: boolean;
  targetId: string | null;
}

export interface RtDawnState {
  kill: boolean;
  deadId: string | null;
}

export interface RtState {
  phase: RtPhase;
  config: RtConfig;
  seats: RtSeat[];
  questIndex: number; // 0 - 4
  quests: RtQuestRecord[];
  leaderId: string | null;
  rejectCount: number;
  proposedTeam: string[];
  votes: Record<string, boolean>;
  lastVote: RtVoteSnapshot | null;
  questCards: Record<string, RtCard>;
  lastQuestFails: number | null;
  night: RtNightState;
  lastGuardTarget: string | null;
  seerChecks: RtSeerCheck[];
  suspicions: RtSuspicion[];
  events: RtEvent[];
  dawn: RtDawnState | null;
  hunter: RtHunterState | null;
  hunt: RtWolfPick;
  huntTargetId: string | null;
  winner: RtTeam | null;
  winReason: string;
}

export interface RoundtableHostRoom extends PeerHostRoomBase {
  gameState: RtState;
}

// ───────── 視角 ─────────

export interface RtSeatView {
  playerId: string;
  name: string;
  alive: boolean;
  left: boolean;
  deathRound: number | null;
  ready: boolean;
  hasVoted: boolean;
  role?: RtRole; // 只有有權看到時才會給
}

export type RtNightTask = 'WOLF' | 'SEER' | 'GUARD' | 'REFLECT' | 'DEAD';

export interface RtNightView {
  kill: boolean; // 公開：今晚狼人是否能殺人
  progress: { done: number; total: number };
  task: RtNightTask;
  myDone: boolean;
  wolf?: RtWolfPickView; // 狼人（kill 的夜晚）
  guardTarget?: string | null;
  reflectTarget?: string | null;
}

export interface RtWolfPickView {
  picks: Record<string, string>;
  locked: boolean;
}

export interface RtHuntView {
  isWolfSide: boolean;   // 狼人陣營（含已死的狼）才拿得到 picks
  candidates: string[];  // 可以被猜的人（存活的好人陣營）
  canPick: boolean;      // 存活的狼人
  picks: Record<string, string>;
}

export interface RtMySeat {
  role: RtRole;
  team: RtTeam;
  alive: boolean;
  ready: boolean;
  mates?: { playerId: string; role: RtRole }[]; // 狼人陣營：其他壞人隊友（隱狼有標記）
  seerChecks?: RtSeerCheck[];                    // 預言家：歷次查驗
  lastGuardTarget?: string | null;               // 守衛：上一晚守誰
}

export interface RtQuestView {
  round: number;
  requiredPlayers: number;
  requiresTwoFails: boolean;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  successCount?: number;
  failCount?: number;
  team: string[];
}

export interface RtResultInfo {
  events: RtEvent[];
  bestDetectives: { playerId: string; hits: number; total: number }[];
  huntTargetId: string | null;
  huntCorrect: boolean | null;
}

export interface RoundtableRoomView extends PeerViewBase {
  phase: RtPhase;
  config: RtResolvedConfig;
  seats: RtSeatView[];
  mySeat: RtMySeat | null; // null = 旁觀者（對局中才加入）
  quests: RtQuestView[];
  questIndex: number;
  rejectCount: number;
  leaderId: string | null;
  proposedTeam: string[];
  myVote: boolean | null;
  lastVote: RtVoteSnapshot | null;
  myQuestCard: RtCard | null;
  questSubmitted: number;
  lastQuestFails: number | null;
  night: RtNightView | null;
  dawn: RtDawnState | null;
  hunter: RtHunterState | null;
  hunt: RtHuntView | null;
  winner: RtTeam | null;
  winReason: string;
  result: RtResultInfo | null;
}

export type RoundtableAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<RtResolvedConfig> }
  | { action: 'START' }
  | { action: 'READY' }
  | { action: 'PROPOSE'; team: string[] }
  | { action: 'VOTE'; approve: boolean }
  | { action: 'QUEST_CARD'; success: boolean }
  | { action: 'WOLF_PICK'; targetId: string }
  | { action: 'SEER_CHECK'; targetId: string }
  | { action: 'GUARD'; targetId: string }
  | { action: 'REFLECT'; targetId: string }
  | { action: 'HUNTER_SHOT'; targetId: string }
  | { action: 'HUNT_PICK'; targetId: string }
  | { action: 'CONTINUE' }
  | { action: 'FORCE_RESOLVE' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' }
  | { action: 'ADD_BOT' }; // 只有房主，由連線層處理，不會進規則引擎
