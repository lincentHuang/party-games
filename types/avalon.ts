// types/avalon.ts

export type AvalonRole =
  | 'MERLIN'          // 梅林 (正義)
  | 'PERCIVAL'        // 派西維爾 (正義)
  | 'SERVANT'         // 亞瑟的忠臣 (正義)
  | 'ASSASSIN'        // 刺客 (邪惡)
  | 'MORGANA'         // 莫甘娜 (邪惡)
  | 'MORDRED'         // 莫德雷德 (邪惡)
  | 'OBERON';         // 奧伯倫 (邪惡)

export type AvalonAlignment = 'GOOD' | 'EVIL';

export interface AvalonPlayer {
  id: string;
  name: string;
  role: AvalonRole;
  alignment: AvalonAlignment;
  isLeader?: boolean;
}

export type AvalonPhase =
  | 'SETUP'            // 人數與角色配置
  | 'ROLE_REVEAL'      // 身份確認 (單機傳閱或掃碼)
  | 'TEAM_PROPOSE'     // 領袖指派遠征隊伍
  | 'TEAM_VOTE'        // 全員投票 (贊成/反對)
  | 'VOTE_RESULT'      // 表決結果公佈
  | 'QUEST_EXECUTION'  // 遠征成員暗中投出成功/失敗
  | 'QUEST_RESULT'     // 遠征結果揭曉
  | 'ASSASSINATION'    // 刺客刺殺梅林
  | 'RESULT';          // 終局結果揭曉

export interface QuestInfo {
  round: number;          // 1 - 5
  requiredPlayers: number;
  requiresTwoFails: boolean; // 7人以上第4局需2失敗
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  successCount?: number;
  failCount?: number;
}

export interface VoteRecord {
  voterId: string;
  voterName: string;
  approve: boolean;
}

export interface AvalonConfig {
  playerCount: number;
  usePercival: boolean;
  useMorgana: boolean;
  useMordred: boolean;
  useOberon: boolean;
  playerNames: string[];
}
