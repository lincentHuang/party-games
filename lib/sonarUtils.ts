// lib/sonarUtils.ts
import { GridCoord, SubmarineState, SonarGameState } from '@/types/sonar';

// 8x8 海域島嶼固定座標 (不可穿越障礙物)
export const ISLANDS: GridCoord[] = [
  { x: 1, y: 1 },
  { x: 2, y: 5 },
  { x: 5, y: 2 },
  { x: 6, y: 6 },
  { x: 3, y: 3 },
  { x: 4, y: 4 }
];

export function isIsland(coord: GridCoord): boolean {
  return ISLANDS.some(island => island.x === coord.x && island.y === coord.y);
}

export function coordToString(coord: GridCoord): string {
  const colLetter = String.fromCharCode(65 + coord.x); // 0 -> 'A'
  const rowNumber = coord.y + 1; // 0 -> 1
  return `${colLetter}${rowNumber}`;
}

export function parseCoordString(str: string): GridCoord | null {
  const clean = str.trim().toUpperCase();
  if (clean.length < 2) return null;
  const col = clean.charCodeAt(0) - 65;
  const row = parseInt(clean.substring(1), 10) - 1;
  if (col >= 0 && col < 8 && row >= 0 && row < 8) {
    return { x: col, y: row };
  }
  return null;
}

// 取得象限 (1: 西北, 2: 東北, 3: 西南, 4: 東南)
export function getSector(coord: GridCoord): number {
  if (coord.x < 4 && coord.y < 4) return 1;
  if (coord.x >= 4 && coord.y < 4) return 2;
  if (coord.x < 4 && coord.y >= 4) return 3;
  return 4;
}

export function getSectorName(sector: number): string {
  switch (sector) {
    case 1: return '第 1 區（西北海域）';
    case 2: return '第 2 區（東北海域）';
    case 3: return '第 3 區（西南海域）';
    case 4: return '第 4 區（東南海域）';
    default: return '未知海域';
  }
}

// 建立初始潛艦狀態
export function createInitialSub(team: 'RED' | 'BLUE'): SubmarineState {
  const startPos: GridCoord = team === 'RED' ? { x: 0, y: 0 } : { x: 7, y: 7 };
  return {
    team,
    name: team === 'RED' ? '赤潮號 (RED-01)' : '深藍號 (BLUE-02)',
    pos: startPos,
    hp: 4,
    maxHp: 4,
    trail: [startPos],
    energy: {
      torpedo: 0,
      sonar: 0,
      silence: 0,
      mine: 0
    },
    mines: []
  };
}

// 建立初始完整對局狀態
export function createInitialSonarGame(): SonarGameState {
  return {
    phase: 'PLAYING',
    turnTeam: 'RED',
    roundNumber: 1,
    redSub: createInitialSub('RED'),
    blueSub: createInitialSub('BLUE'),
    winnerTeam: null,
    lastTorpedoHit: null,
    logs: [
      {
        id: 'init_1',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: '雙方潛艇已潛入戰術海域，紅隊掌舵先行！',
        type: 'SYSTEM'
      }
    ]
  };
}

// 計算距離
export function getChebyshevDistance(a: GridCoord, b: GridCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
