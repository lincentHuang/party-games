// components/sonar/OceanGrid.tsx
'use client';

import React from 'react';
import { GridCoord, SubmarineState } from '@/types/sonar';
import { isIsland, coordToString, getChebyshevDistance } from '@/lib/sonarUtils';

interface OceanGridProps {
  mySub: SubmarineState;
  isTargetingMode: boolean;
  onSelectTarget: (coord: GridCoord) => void;
  lastHitCoord?: GridCoord | null;
}

export const OceanGrid: React.FC<OceanGridProps> = ({
  mySub,
  isTargetingMode,
  onSelectTarget,
  lastHitCoord
}) => {
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const rows = [1, 2, 3, 4, 5, 6, 7, 8];

  const handleCellClick = (x: number, y: number) => {
    const coord: GridCoord = { x, y };
    if (isIsland(coord)) return;
    if (isTargetingMode) {
      onSelectTarget(coord);
    }
  };

  return (
    <div className="sonar-radar-frame">
      {/* 頂部欄位標頭 A - H */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', textAlign: 'center', marginBottom: '4px' }}>
        {cols.map(c => (
          <span key={c} style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
            {c}
          </span>
        ))}
      </div>

      {/* 8x8 海域網格 */}
      <div className="sonar-grid">
        {rows.map((rowNum, y) => (
          <React.Fragment key={y}>
            {cols.map((colName, x) => {
              const coord: GridCoord = { x, y };
              const isAnIsland = isIsland(coord);
              const isMyPosition = mySub.pos.x === x && mySub.pos.y === y;
              const isInTrail = mySub.trail.some(t => t.x === x && t.y === y);
              const isHit = lastHitCoord?.x === x && lastHitCoord?.y === y;

              // 是否在魚雷射程內 (距離自身 <= 3)
              const inTorpedoRange = isTargetingMode && getChebyshevDistance(mySub.pos, coord) <= 3 && !isAnIsland;

              let cellClass = 'sonar-cell';
              if (isAnIsland) cellClass += ' sonar-cell-island';
              else if (isHit) cellClass += ' sonar-cell-hit';
              else if (isMyPosition) cellClass += ' sonar-cell-sub';
              else if (isInTrail) cellClass += ' sonar-cell-trail';

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={() => handleCellClick(x, y)}
                  className={cellClass}
                  title={`${colName}${rowNum}`}
                  style={{
                    boxShadow: inTorpedoRange ? 'inset 0 0 8px rgba(244, 63, 94, 0.7)' : undefined,
                    borderColor: inTorpedoRange ? 'var(--accent-magenta)' : undefined
                  }}
                >
                  {isAnIsland && <span style={{ fontSize: '0.8rem' }}>⛰️</span>}
                  {isMyPosition && (
                    <span style={{ fontSize: '0.9rem', zIndex: 5 }}>
                      {mySub.team === 'RED' ? '🔴' : '🔵'}
                    </span>
                  )}
                  {!isMyPosition && isInTrail && !isAnIsland && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-yellow)' }} />
                  )}
                  {inTorpedoRange && !isMyPosition && (
                    <span style={{ position: 'absolute', fontSize: '0.65rem', color: 'var(--accent-magenta)', fontWeight: 800 }}>
                      🎯
                    </span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* 底部雷達圖例說明 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '0 4px', fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span>🔵 己方潛艇</span>
          <span>🟡 航跡禁區</span>
          <span>⛰️ 島嶼障礙</span>
        </div>
        <div>
          座標：<strong style={{ color: 'var(--accent-cyan)' }}>{coordToString(mySub.pos)}</strong>
        </div>
      </div>
    </div>
  );
};
