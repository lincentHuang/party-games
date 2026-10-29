/**
 * 阿瓦隆 - 多手機房間版型別
 * 房主手機保存完整狀態（AvalonHostRoom，含所有人的角色與秘密票），
 * 每支手機只拿到 buildAvalonView 算出的自己視角（AvalonRoomView）。
 */

import { AvalonAlignment, AvalonRole, QuestInfo } from '@/types/avalon';
import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type AvalonRoomPhase =
  | 'LOBBY'
  | 'REVEAL'        // 看自己的角色與夜間視野
  | 'PROPOSE'       // 隊長挑隊員
  | 'TEAM_VOTE'     // 全員秘密投票
  | 'VOTE_RESULT'   // 公開每個人的票
  | 'QUEST'         // 隊員秘密出任務牌
  | 'QUEST_RESULT'  // 公開成功／失敗張數
  | 'LADY'          // 湖中仙女查驗
  | 'ASSASSINATE'   // 刺客刺殺梅林
  | 'RESULT';

export interface AvalonRoomConfig {
  usePercival: boolean;
  useMorgana: boolean;
  useMordred: boolean;
  useOberon: boolean;
  // null = 依人數自動（7 人以上開）；房主手動切換後變成 true／false
  useLady: boolean | null;
}

export interface AvalonSeat {
  playerId: string;
  role: AvalonRole;
  alignment: AvalonAlignment;
  ready: boolean;
}

export interface AvalonQuestRecord extends QuestInfo {
  team: string[]; // 出任務的人（公開）
}

export type AvalonCard = 'SUCCESS' | 'FAIL';

export interface AvalonVoteSnapshot {
  round: number;
  leaderId: string;
  team: string[];
  votes: Record<string, boolean>; // 開票後才公開
  approved: boolean;
  rejectCount: number; // 這次表決後的連續否決次數
}

export interface AvalonLadyCheck {
  holderId: string;
  targetId: string;
  alignment: AvalonAlignment; // 只有 holder 本人看得到
}

export interface AvalonRoomState {
  phase: AvalonRoomPhase;
  config: AvalonRoomConfig;
  seats: AvalonSeat[];
  questIndex: number; // 0 - 4
  quests: AvalonQuestRecord[];
  leaderId: string | null;
  rejectCount: number;
  proposedTeam: string[];
  votes: Record<string, boolean>;
  lastVote: AvalonVoteSnapshot | null;
  questCards: Record<string, AvalonCard>;
  lastQuestFails: number | null; // 最近一次任務的失敗張數（QUEST_RESULT 用）
  // 湖中仙女
  ladyEnabled: boolean;
  ladyHolderId: string | null;
  ladyHolders: string[]; // 曾經持有過（含目前）
  ladyChecks: AvalonLadyCheck[];
  ladyChecked: boolean; // 這次 LADY 階段是否已查驗
  assassinTargetId: string | null;
  winner: AvalonAlignment | null;
  winReason: string;
  lastNotice: string | null;
}

export interface AvalonHostRoom extends PeerHostRoomBase {
  gameState: AvalonRoomState;
}

export interface AvalonSeatView {
  playerId: string;
  name: string;
  ready: boolean;
  hasVoted: boolean; // TEAM_VOTE 時是否已投（不含內容）
  role?: AvalonRole; // 只有終局才給
}

export interface AvalonVisionEntry {
  playerId: string;
  name: string;
  label: string;
}

export interface AvalonQuestView {
  round: number;
  requiredPlayers: number;
  requiresTwoFails: boolean;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  successCount?: number;
  failCount?: number;
  team: string[];
}

export interface AvalonRoomView extends PeerViewBase {
  phase: AvalonRoomPhase;
  config: AvalonRoomConfig; // useLady 已換算成實際值
  lastNotice: string | null;
  seats: AvalonSeatView[];
  // null = 旁觀者（對局中才加入）
  mySeat: {
    role: AvalonRole;
    alignment: AvalonAlignment;
    ready: boolean;
    vision: AvalonVisionEntry[];
  } | null;
  quests: AvalonQuestView[];
  questIndex: number;
  rejectCount: number;
  leaderId: string | null;
  proposedTeam: string[];
  myVote: boolean | null;
  lastVote: AvalonVoteSnapshot | null;
  myQuestCard: AvalonCard | null;
  questSubmitted: number; // 已交出任務牌的人數（不含內容）
  lastQuestFails: number | null;
  lady: {
    enabled: boolean;
    holderId: string | null;
    holders: string[];
    history: { holderId: string; targetId: string }[]; // 公開：誰查了誰
    candidates: string[]; // 現在可以被查驗的人
    checkedThisRound: boolean;
    myResults: { targetId: string; alignment: AvalonAlignment }[]; // 只有自己查驗過的
  };
  // 只有壞人在刺殺階段（與終局）拿得到
  evilTeam: { playerId: string; name: string; isAssassin: boolean }[] | null;
  assassinTargetId: string | null;
  winner: AvalonAlignment | null;
  winReason: string;
}

export type AvalonAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<AvalonRoomConfig> }
  | { action: 'START' }
  | { action: 'READY' }
  | { action: 'PROPOSE'; team: string[] }
  | { action: 'VOTE'; approve: boolean }
  | { action: 'QUEST_CARD'; success: boolean }
  | { action: 'LADY_CHECK'; targetId: string }
  | { action: 'LADY_DONE' }
  | { action: 'ASSASSINATE'; targetId: string }
  | { action: 'CONTINUE' }
  | { action: 'FORCE_RESOLVE' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' }
  | { action: 'ADD_BOT' }; // 只有房主，由連線層處理，不會進規則引擎
