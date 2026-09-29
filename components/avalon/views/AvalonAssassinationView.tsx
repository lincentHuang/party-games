// components/avalon/views/AvalonAssassinationView.tsx
'use client';

import React, { useState } from 'react';
import { AvalonPlayer } from '@/types/avalon';
import { soundManager } from '@/lib/soundManager';

interface AvalonAssassinationViewProps {
  players: AvalonPlayer[];
  onExecuteAssassination: (targetId: string) => void;
}

export const AvalonAssassinationView: React.FC<AvalonAssassinationViewProps> = ({
  players,
  onExecuteAssassination
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  // 找出刺客是誰
  const assassin = players.find(p => p.role === 'ASSASSIN') || players.find(p => p.alignment === 'EVIL');
  // 刺客只能刺殺好人
  const targetCandidates = players.filter(p => p.alignment === 'GOOD');

  const handleConfirm = () => {
    if (!selectedTarget) return;
    soundManager.playClick();
    onExecuteAssassination(selectedTarget);
  };

  return (
    <div className="view-container view-enter text-center" style={{ justifyContent: 'center' }}>
      <div className="mb-md">
        <span className="badge badge-classified mb-xs">
          ⚡ 聖杯已落入正義之手，最後反擊！
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-magenta)', margin: '4px 0 6px' }}>
          🗡️ 刺客刺殺梅林
        </h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
          刺客【{assassin?.name || '刺客'}】請現身，邪惡陣營可集思廣益，指出真正的梅林是誰！
        </p>
      </div>

      <div className="card mb-lg" style={{ padding: '16px', textAlign: 'left' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', marginBottom: '8px' }}>
          🎯 選擇刺殺目標（若命中梅林，邪惡方逆轉奪勝）：
        </div>
        <div className="flex-col gap-xs">
          {targetCandidates.map(p => {
            const isSelected = selectedTarget === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedTarget(p.id);
                }}
                className="flex-between"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(244, 63, 94, 0.2)' : 'var(--bg-elevated)',
                  border: `1px solid ${isSelected ? 'var(--accent-magenta)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎯</span>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>
                    {p.name}
                  </span>
                </div>
                {isSelected && (
                  <span className="badge badge-classified">鎖定目標</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={!selectedTarget}
        className="btn btn-primary btn-large btn-full"
        style={{
          background: 'var(--accent-magenta)',
          color: '#ffffff',
          fontWeight: 800,
          opacity: selectedTarget ? 1 : 0.4
        }}
      >
        🗡️ 確認暗殺！揭曉生死！
      </button>
    </div>
  );
};
