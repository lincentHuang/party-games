/**
 * 誰是間諜 - 多手機房間版型別
 * 房主手機保存完整狀態（SpyHostRoom），透過 PeerJS 傳給每支手機各自的視角（SpyRoomView）
 */

import { Difficulty, Role, WordPair } from '@/types/game';
import { PeerHostRoomBase, PeerRoomPlayer } from '@/types/peerRoom';

export type SpyRoomPhase = 'LOBBY' | 'REVEAL' | 'DESCRIBE' | 'VOTE' | 'ELIMINATED' | 'RESULT';

export interface SpyRoomConfig {
  spyCount: number;
  hasBlank: boolean;
  speechTime: number; // 秒 (0 = 不限時)
  showRoleOnEliminated: boolean;
  difficulties: Difficulty[];
  categories: string[];
}

export interface SpySeat {
  playerId: string;
  role: Role;
  word: string;
  isAlive: boolean;
  eliminatedRound: number | null;
  left: boolean; // 中途離開房間
  ready: boolean; // 看詞完畢
}

export interface SpyElimination {
  round: number;
  playerId: string | null; // null = 平票無人出局
  tally: Record<string, number>;
}

export interface SpyRoomState {
  phase: SpyRoomPhase;
  config: SpyRoomConfig;
  round: number;
  seats: SpySeat[];
  wordPair: WordPair | null;
  // 本輪發言順序（玩家 id）與目前輪到第幾位
  speakQueue: string[];
  speakIndex: number;
  speakStartedAt: number;
  roundStarterId: string | null;
  // 投票：voterId -> targetId；candidates 為可被投的人（平票 PK 時縮小範圍）
  votes: Record<string, string>;
  candidates: string[];
  voteAttempt: number;
  lastElimination: SpyElimination | null;
  winner: Role | null;
  winReason: string;
  recentWords: string[];
}

export type SpyRoomPlayer = PeerRoomPlayer;

// 房主手機上的完整房間
export interface SpyHostRoom extends PeerHostRoomBase {
  gameState: SpyRoomState;
}

export interface SpySeatView {
  playerId: string;
  name: string;
  isAlive: boolean;
  eliminatedRound: number | null;
  left: boolean;
  ready: boolean;
  hasVoted: boolean;
  role?: Role; // 只有公開時才會給（出局明牌或終局）
  word?: string; // 只有終局才會給
}

export interface SpyRoomView {
  roomId: string;
  version: number;
  serverNow: number;
  hostId: string;
  me: { id: string; name: string; isHost: boolean };
  players: { id: string; name: string; isHost: boolean; online: boolean }[];
  phase: SpyRoomPhase;
  config: SpyRoomConfig;
  round: number;
  seats: SpySeatView[];
  mySeat: { word: string; isAlive: boolean; ready: boolean } | null; // null = 旁觀者
  wordInfo: { category: string; difficulty: Difficulty } | null;
  speakQueue: string[];
  speakIndex: number;
  speakStartedAt: number;
  candidates: string[];
  myVote: string | null;
  voteAttempt: number;
  lastElimination: (SpyElimination & { role?: Role }) | null;
  winner: Role | null;
  winReason: string;
  wordPair: WordPair | null; // 只有終局才會給
}

export type SpyAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<SpyRoomConfig> }
  | { action: 'START'; customWords?: WordPair[] }
  | { action: 'READY' }
  | { action: 'NEXT_SPEAKER' }
  | { action: 'VOTE'; targetId: string }
  | { action: 'CLOSE_VOTE' }
  | { action: 'CONTINUE' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' };
