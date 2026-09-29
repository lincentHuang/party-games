// components/wonders/ConflictModal.tsx
'use client';

import React from 'react';
import { WondersGameState } from '@/types/wonders';

interface ConflictModalProps {
  results: WondersGameState['conflictResults'];
  onContinue: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({ results, onContinue }) => {
  if (!results) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-sheet text-center" style={{ maxWidth: '440px' }}>
        <span style={{ fontSize: '3rem' }}>⚔️</span>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 6px' }}>
          第 {results.age} 時代軍事衝突結算
        </h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
          各城邦比拼軍事盾牌，勝者獲取戰功積分，敗者扣除 1 分！
        </p>

        <div className="flex-col gap-xs mb-md" style={{ textAlign: 'left' }}>
          {results.summaries.map(s => {
            const isPositive = s.tokenDelta >= 0;
            return (
              <div
                key={s.playerId}
                className="flex-between"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#ffffff' }}>
                    {s.playerName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                    🛡️ {s.shields} 盾牌
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    className="badge"
                    style={{
                      background: isPositive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
                      color: isPositive ? 'var(--accent-emerald)' : 'var(--accent-magenta)',
                      fontWeight: 900,
                      fontSize: '0.9rem'
                    }}
                  >
                    {s.tokenDelta > 0 ? `+${s.tokenDelta}` : s.tokenDelta} 戰功分
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onContinue} className="btn btn-primary btn-large btn-full">
          {results.age >= 3 ? '🏆 進入最終文明總結算！' : `🚀 前進至第 ${results.age + 1} 時代！`}
        </button>
      </div>
    </div>
  );
};
