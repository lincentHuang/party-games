// types/sonar.ts

export type SubmarineDirection = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export interface GridCoord {
  x: number; // 0 to 7 (Columns A to H)
  y: number; // 0 to 7 (Rows 1 to 8)
}

export interface SubmarineState {
  team: 'RED' | 'BLUE';
  name: string;
  pos: GridCoord;
  hp: number; // 初始 4 點
  maxHp: number;
  trail: GridCoord[];
  energy: {
    torpedo: number; // 滿 3 可發射
    sonar: number;   // 滿 3 可探測
    silence: number; // 滿 4 可靜音潛航
    mine: number;    // 滿 3 可埋水雷
  };
  mines: GridCoord[];
  isSurfaced?: boolean;
}

export interface SonarEventLog {
  id: string;
  time: string;
  text: string;
  type: 'INFO' | 'ATTACK' | 'HIT' | 'SONAR' | 'SURFACE' | 'SYSTEM';
}

export interface SonarGameState {
  phase: 'LOBBY' | 'PLAYING' | 'GAMEOVER';
  turnTeam: 'RED' | 'BLUE';
  roundNumber: number;
  redSub: SubmarineState;
  blueSub: SubmarineState;
  winnerTeam?: 'RED' | 'BLUE' | null;
  lastTorpedoHit?: { coord: GridCoord; isDirect: boolean; hitTeam: 'RED' | 'BLUE' } | null;
  logs: SonarEventLog[];
}
