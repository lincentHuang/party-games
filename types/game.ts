/**
 * 誰是間諜 - TypeScript 型別定義
 */

export type Phase = 'HOME' | 'SETUP' | 'REVEAL' | 'PLAY' | 'VOTE' | 'RESULT' | 'WORDS';

export type Role = 'CIVILIAN' | 'SPY' | 'BLANK';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface WordPair {
  id?: string;
  civilian: string;
  spy: string;
  difficulty: Difficulty;
  category: string;
  isCustom?: boolean;
  createdAt?: string;
}

export interface Player {
  id: number;
  code: string;
  name: string;
  icon: string;
  role: Role;
  word: string;
  isAlive: boolean;
  eliminatedRound: number | null;
}

export interface GameConfig {
  playerCount: number;
  spyCount: number;
  hasBlank: boolean;
  speechTime: number; // 秒 (0 = 不限時)
  showRoleOnEliminated: boolean; // 明牌/暗牌
  difficulties: Difficulty[];
  categories: string[];
  playerNames: string[];
}

export interface EliminationRecord {
  player: Player;
  round: number;
  votes: number;
}

export interface VictoryStatus {
  isGameOver: boolean;
  winner: Role | null;
  reason?: string;
}

export interface VoteTallyResult {
  isTie: boolean;
  tiedPlayers?: Player[];
  eliminatedPlayer?: Player | null;
  maxVotes: number;
  tally: Record<number, number>;
  victoryStatus?: VictoryStatus;
}
