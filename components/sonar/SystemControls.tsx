// components/sonar/SystemControls.tsx
'use client';

import React from 'react';
import { SubmarineState, SubmarineDirection } from '@/types/sonar';

interface SystemControlsProps {
  mySub: SubmarineState;
  isMyTurn: boolean;
  isTargetingMode: boolean;
  onMove: (dir: SubmarineDirection) => void;
  onToggleTargeting: () => void;
  onPingSonar: () => void;
  onSurface: () => void;
}

export const SystemControls: React.FC<SystemControlsProps> = ({
  mySub,
  isMyTurn,
  isTargetingMode,
  onMove,
  onToggleTargeting,
  onPingSonar,
  onSurface
}) => {
  const canFireTorpedo = mySub.energy.torpedo >= 3;
  const canPingSonar = mySub.energy.sonar >= 3;

  return (
    <div className="card" style={{ padding: '14px' }}>
      {/* 潛艦系統能量充能列 */}
      <div className="flex-between mb-sm" style={{ gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <div className="flex-between" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg-secondary)', marginBottom: '2px' }}>
            <span>🚀 魚雷</span>
            <span>{mySub.energy.torpedo} / 3</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(mySub.energy.torpedo / 3) * 100}%`, height: '100%', background: 'var(--accent-magenta)' }} />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div className="flex-between" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--fg-secondary)', marginBottom: '2px' }}>
            <span>📡 聲納</span>
            <span>{mySub.energy.sonar} / 3</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${(mySub.energy.sonar / 3) * 100}%`, height: '100%', background: 'var(--accent-cyan)' }} />
          </div>
        </div>
      </div>

      {/* 舵手航向控制區 (Helm) 與戰術系統 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
        {/* 十字方向鍵 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => onMove('NORTH')}
            disabled={!isMyTurn || isTargetingMode}
            className="helm-btn"
            title="向北航行"
            style={{ opacity: isMyTurn && !isTargetingMode ? 1 : 0.4 }}
          >
            ⬆️
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => onMove('WEST')}
              disabled={!isMyTurn || isTargetingMode}
              className="helm-btn"
              title="向西航行"
              style={{ opacity: isMyTurn && !isTargetingMode ? 1 : 0.4 }}
            >
              ⬅️
            </button>
            <div style={{ width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--fg-muted)', fontWeight: 800 }}>
              舵手
            </div>
            <button
              onClick={() => onMove('EAST')}
              disabled={!isMyTurn || isTargetingMode}
              className="helm-btn"
              title="向東航行"
              style={{ opacity: isMyTurn && !isTargetingMode ? 1 : 0.4 }}
            >
              ➡️
            </button>
          </div>
          <button
            onClick={() => onMove('SOUTH')}
            disabled={!isMyTurn || isTargetingMode}
            className="helm-btn"
            title="向南航行"
            style={{ opacity: isMyTurn && !isTargetingMode ? 1 : 0.4 }}
          >
            ⬇️
          </button>
        </div>

        {/* 右側戰術系統按鈕 */}
        <div className="flex-col gap-xs">
          {/* 發射魚雷 */}
          <button
            onClick={onToggleTargeting}
            disabled={!isMyTurn || !canFireTorpedo}
            className="btn"
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: isTargetingMode ? 'var(--accent-magenta)' : canFireTorpedo ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${canFireTorpedo ? 'var(--accent-magenta)' : 'transparent'}`,
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: canFireTorpedo ? 1 : 0.4
            }}
          >
            <span>🚀 {isTargetingMode ? '點網格鎖定目標' : '發射魚雷'}</span>
            <span style={{ fontSize: '0.75rem' }}>{canFireTorpedo ? '就緒' : `${mySub.energy.torpedo}/3`}</span>
          </button>

          {/* 聲納探測 */}
          <button
            onClick={onPingSonar}
            disabled={!isMyTurn || !canPingSonar || isTargetingMode}
            className="btn"
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: canPingSonar ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${canPingSonar ? 'var(--accent-cyan)' : 'transparent'}`,
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: canPingSonar ? 1 : 0.4
            }}
          >
            <span>📡 聲納探測</span>
            <span style={{ fontSize: '0.75rem' }}>{canPingSonar ? '就緒' : `${mySub.energy.sonar}/3`}</span>
          </button>

          {/* 浮出水面 */}
          <button
            onClick={() => {
              if (confirm('確定要浮出水面嗎？這會清除自身航跡，但敵方將獲知你所在海區！')) {
                onSurface();
              }
            }}
            disabled={!isMyTurn || isTargetingMode}
            className="btn"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: 'var(--accent-yellow)',
              fontWeight: 700,
              fontSize: '0.8rem',
              opacity: isMyTurn ? 1 : 0.4
            }}
          >
            🚨 浮出水面 (清空軌跡)
          </button>
        </div>
      </div>
    </div>
  );
};
