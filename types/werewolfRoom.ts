/**
 * 狼人殺（手機當法官）- 多手機房間版型別
 * 房主手機保存完整狀態（WerewolfHostRoom），每支手機只收到自己看得到的視角（WerewolfRoomView）
 */

import { PeerHostRoomBase, PeerViewBase } from '@/types/peerRoom';

export type WerewolfRole = 'WOLF' | 'VILLAGER' | 'SEER' | 'WITCH' | 'HUNTER' | 'GUARD';
export type WerewolfTeam = 'WOLF' | 'GOOD';
export type WinMode = 'SIDE' | 'CITY'; // 屠邊 / 屠城

export type WerewolfPhase =
  | 'LOBBY'
  | 'REVEAL'
  | 'NIGHT'
  | 'NIGHT_WITCH'
  | 'DAWN'
  | 'HUNTER'
  | 'DAY'
  | 'VOTE'
  | 'EXILE'
  | 'RESULT';

// 「不選任何人」的代號（空守、空刀、棄票、獵人放棄）
export const NONE = 'NONE';

export interface WerewolfConfig {
  auto: boolean; // true = 配置跟著人數走（房主手動調整後變 false）
  wolfCount: number;
  seer: boolean;
  witch: boolean;
  hunter: boolean;
  guard: boolean;
  winMode: WinMode;
  speechTime: number; // 秒 (0 = 不限時)
  showRoleOnDeath: boolean;
}

export type DeathCause = 'WOLF' | 'POISON' | 'EXILE' | 'HUNTER' | 'LEAVE';

export interface WerewolfSeat {
  playerId: string;
  role: WerewolfRole;
  isAlive: boolean;
  deathRound: number | null;
  deathCause: DeathCause | null;
  left: boolean;
  ready: boolean;
}

export interface NightState {
  guardSet: boolean;
  guardTarget: string | null;
  wolfPicks: Record<string, string>; // wolfId -> targetId | NONE
  wolfLocked: boolean;
  wolfTarget: string | null;
  seerDone: boolean;
  reflect: Record<string, string>; // 夜間推理：playerId -> 懷疑的人
  witchDone: boolean;
  witchSave: boolean;
  witchPoison: string | null;
  ack: Record<string, boolean>; // 女巫階段「繼續閉眼」
}

export interface WerewolfEvent {
  round: number;
  step: 'NIGHT' | 'DAY';
  type: 'GUARD' | 'WOLF_KILL' | 'SAVE' | 'POISON' | 'SEER' | 'DEATH' | 'EXILE' | 'HUNTER' | 'LEAVE';
  actorId?: string;
  targetId?: string | null; // null = 空守／空刀／放棄
  isWolf?: boolean;
  cause?: DeathCause;
}

export interface SeerCheck {
  round: number;
  targetId: string;
  isWolf: boolean;
}

export interface Suspicion {
  round: number;
  playerId: string;
  targetId: string;
}

export interface HunterState {
  hunterId: string;
  resolved: boolean;
  targetId: string | null;
}

export interface LastWordsState {
  queue: string[];
  index: number;
}

export interface Ballot {
  attempt: number; // 0 = 第一次投票，1 = 平票 PK
  votes: Record<string, string>; // voterId -> targetId | NONE
}

export interface ExileResult {
  round: number;
  playerId: string | null; // null = 無人放逐
  tally: Record<string, number>;
  ballots: Ballot[];
}

export interface WerewolfState {
  phase: WerewolfPhase;
  config: WerewolfConfig;
  round: number;
  seats: WerewolfSeat[];
  night: NightState;
  antidoteLeft: boolean;
  poisonLeft: boolean;
  lastGuardTarget: string | null;
  seerChecks: SeerCheck[];
  suspicions: Suspicion[];
  events: WerewolfEvent[];
  dawnDeaths: string[];
  afterPhase: 'DAY' | 'NIGHT';
  lastWords: LastWordsState | null;
  hunter: HunterState | null;
  speakQueue: string[];
  speakIndex: number;
  speakStartedAt: number;
  votes: Record<string, string>;
  candidates: string[];
  voteAttempt: number;
  ballots: Ballot[];
  lastExile: ExileResult | null;
  winner: WerewolfTeam | null;
  winReason: string;
}

// 房主手機上的完整房間
export interface WerewolfHostRoom extends PeerHostRoomBase {
  gameState: WerewolfState;
}

export interface WerewolfSeatView {
  playerId: string;
  name: string;
  isAlive: boolean;
  deathRound: number | null;
  left: boolean;
  ready: boolean;
  hasVoted: boolean;
  role?: WerewolfRole; // 只有有權看到時才會給
}

export type NightTask = 'GUARD' | 'WOLF' | 'SEER' | 'REFLECT' | 'WITCH' | 'ACK' | 'DEAD';

// 夜晚：只有「已完成 x / 存活 n」是公開的，其餘只給本人
export interface WerewolfNightView {
  progress: { done: number; total: number };
  task: NightTask;
  myDone: boolean;
  guard?: { target: string | null; lastTarget: string | null };
  wolf?: { picks: Record<string, string>; locked: boolean };
  reflectTarget?: string | null;
  witch?: { victimKnown: boolean; victimId: string | null };
}

export interface WerewolfMySeat {
  role: WerewolfRole;
  isAlive: boolean;
  ready: boolean;
  mates?: string[]; // 狼人：其他狼隊友
  seerChecks?: SeerCheck[]; // 預言家：歷次查驗
  potions?: { antidote: boolean; poison: boolean }; // 女巫：剩下的藥
}

export interface WerewolfResultInfo {
  events: WerewolfEvent[];
  bestDetectives: { playerId: string; hits: number; total: number }[];
}

export interface WerewolfRoomView extends PeerViewBase {
  phase: WerewolfPhase;
  config: WerewolfConfig;
  round: number;
  seats: WerewolfSeatView[];
  mySeat: WerewolfMySeat | null; // null = 旁觀者
  night: WerewolfNightView | null;
  dawnDeaths: string[];
  lastWords: LastWordsState | null;
  hunter: HunterState | null;
  speakQueue: string[];
  speakIndex: number;
  speakStartedAt: number;
  candidates: string[];
  myVote: string | null;
  voteAttempt: number;
  ballots: Ballot[];
  lastExile: ExileResult | null;
  winner: WerewolfTeam | null;
  winReason: string;
  result: WerewolfResultInfo | null;
}

export type WerewolfAction =
  | { action: 'UPDATE_CONFIG'; config: Partial<WerewolfConfig> }
  | { action: 'START' }
  | { action: 'READY' }
  | { action: 'GUARD'; targetId: string }
  | { action: 'WOLF_PICK'; targetId: string }
  | { action: 'SEER_CHECK'; targetId: string }
  | { action: 'REFLECT'; targetId: string }
  | { action: 'WITCH'; choice: 'NONE' | 'SAVE' | 'POISON'; targetId?: string }
  | { action: 'NIGHT_ACK' }
  | { action: 'FORCE_NIGHT' }
  | { action: 'LAST_WORDS_DONE' }
  | { action: 'HUNTER_SHOT'; targetId: string }
  | { action: 'NEXT_SPEAKER' }
  | { action: 'VOTE'; targetId: string }
  | { action: 'CLOSE_VOTE' }
  | { action: 'CONTINUE' }
  | { action: 'BACK_TO_LOBBY' }
  | { action: 'KICK'; targetId: string }
  | { action: 'LEAVE' };
