// types/wonders.ts

export type ResourceType = 'WOOD' | 'STONE' | 'ORE' | 'CLAY' | 'GLASS' | 'PAPYRUS';

export type ScienceSymbol = 'GEAR' | 'COMPASS' | 'TABLET';

export type CardCategory =
  | 'RAW'           // 褐牌：木、石、礦、土
  | 'MANUFACTURED'  // 灰牌：玻璃、紙莎草
  | 'CIVIL'         // 藍牌：市政分數
  | 'COMMERCIAL'    // 黃牌：商業金幣
  | 'MILITARY'      // 紅牌：軍事盾牌
  | 'SCIENCE'       // 綠牌：科技符號
  | 'GUILD';        // 紫牌：公會

export interface WonderCard {
  id: string;
  name: string;
  age: 1 | 2 | 3;
  category: CardCategory;
  cost: {
    coins?: number;
    resources?: Partial<Record<ResourceType, number>>;
  };
  provides: {
    resources?: Partial<Record<ResourceType, number>>;
    coins?: number;
    vp?: number;
    shields?: number;
    science?: ScienceSymbol;
  };
  desc?: string;
}

export interface WonderStage {
  stage: 1 | 2 | 3;
  cost: Partial<Record<ResourceType, number>>;
  vp: number;
  shields?: number;
  coins?: number;
  science?: ScienceSymbol;
  completed: boolean;
}

export interface WonderBoard {
  id: string;
  name: string;
  baseResource: ResourceType;
  stages: WonderStage[];
  desc: string;
  icon: string;
}

export interface WonderPlayer {
  id: string;
  name: string;
  isAi?: boolean;
  wonder: WonderBoard;
  coins: number;
  builtCards: WonderCard[];
  militaryTokens: number[]; // e.g. +1, +3, +5, -1
  hand: WonderCard[];
  selectedCardId?: string | null;
  selectedAction?: 'BUILD' | 'WONDER' | 'DISCARD' | null;
}

export interface WondersGameState {
  phase: 'DRAFTING' | 'CONFLICT' | 'GAMEOVER';
  age: 1 | 2 | 3;
  turnInAge: number; // 1 to 6
  players: WonderPlayer[];
  conflictResults?: {
    age: number;
    summaries: { playerId: string; playerName: string; shields: number; diffLeft: number; diffRight: number; tokenDelta: number }[];
  } | null;
  logs: string[];
}

export interface ScoreSummary {
  playerId: string;
  playerName: string;
  militaryScore: number;
  treasuryScore: number;
  wonderScore: number;
  civilScore: number;
  scienceScore: number;
  commercialScore: number;
  totalScore: number;
}
