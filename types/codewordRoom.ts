/**
 * 密語特工（分隊猜詞）- 多手機房間版型別
 * 房主手機保存完整狀態（含整張答案地圖），每支手機只收到自己看得到的視角：
 * 隊長看得到每張牌的顏色，隊員與旁觀者只看得到已翻開的牌的顏色。
 */

import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type CodewordTeam = 'RED' | 'BLUE';
export type CardColor = 'RED' | 'BLUE' | 'NEUTRAL' | 'ASSASSIN';
export type CodewordPhase = 'LOBBY' | 'CLUE' | 'GUESS' | 'RESULT';
export type ClueNumber = number | 'INF'; // 0–9 或 ∞

export interface CodewordConfig {
  clueTime: number; // 隊長出題提醒秒數（0 = 不限，只提醒不強制）
}

export interface CodewordCard {
  word: string;
  color: CardColor;
  revealed: boolean;
  revealedBy: CodewordTeam | null; // 由哪一隊翻開（顯示用）
}

export interface GuessRecord {
  index: number;
  word: string;
  color: CardColor;
}

export interface ClueRecord {
  team: CodewordTeam;
  captainId: string;
  word: string;
  number: ClueNumber;
  guesses: GuessRecord[];
}

export interface CodewordState {
  phase: CodewordPhase;
  config: CodewordConfig;
  round: number; // 第幾局
  teams: Record<string, CodewordTeam>; // 沒有紀錄 = 還沒選隊（或旁觀者）
  captains: Record<CodewordTeam, string | null>;
  board: CodewordCard[];
  startTeam: CodewordTeam;
  turn: CodewordTeam;
  clue: { word: string; number: ClueNumber } | null;
  guessesUsed: number;
  proposals: Record<string, number>; // 隊員 id -> 提議翻開的牌
  turnStartedAt: number;
  history: ClueRecord[];
  winner: CodewordTeam | null;
  winReason: string;
}

// 房主手機上的完整房間
export interface CodewordHostRoom extends PeerHostRoomBase {
  gameState: CodewordState;
}

export interface CodewordMemberView {
  playerId: string;
  name: string;
  team: CodewordTeam | null;
  isCaptain: boolean;
  isBot: boolean;
  online: boolean;
}

export interface CodewordCardView {
  index: number;
  word: string;
  revealed: boolean;
  revealedBy: CodewordTeam | null;
  color?: CardColor; // 只有已翻開、隊長、或整局結束才有；沒權限時欄位根本不存在
}

export type CodewordRole = 'CAPTAIN' | 'GUESSER' | 'SPECTATOR';

export interface CodewordRoomView extends PeerViewBase {
  phase: CodewordPhase;
  config: CodewordConfig;
  round: number;
  members: CodewordMemberView[];
  board: CodewordCardView[];
  startTeam: CodewordTeam;
  turn: CodewordTeam;
  clue: { word: string; number: ClueNumber } | null;
  guessesUsed: number;
  maxGuesses: number | null; // null = 不限
  proposals: Record<string, number>;
  turnStartedAt: number;
  remaining: Record<CodewordTeam, number>; // 各隊還沒翻開的牌
  myTeam: CodewordTeam | null;
  myRole: CodewordRole;
  history: ClueRecord[];
  winner: CodewordTeam | null;
  winReason: string;
}

export type CodewordAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<CodewordConfig> }
  | { action: 'SET_TEAM'; team: CodewordTeam; targetId?: string } // 沒給 targetId = 自己；房主可以幫別人換
  | { action: 'SET_CAPTAIN'; targetId?: string } // 沒給 targetId = 自願（再按一次放棄）；房主可指定
  | { action: 'SHUFFLE_TEAMS' }
  | { action: 'START' }
  | { action: 'GIVE_CLUE'; word: string; number: ClueNumber }
  | { action: 'PROPOSE'; index: number } // 提議翻開；對自己已提議的牌再點一次 = 收回
  | { action: 'REVEAL'; index: number } // 直接翻開（隊員確認後使用）
  | { action: 'END_GUESS' }
  | { action: 'NEXT_ROUND'; rotateCaptains: boolean }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' }
  | { action: 'ADD_BOT' }; // 只有房主，由連線層處理，不會進規則引擎
