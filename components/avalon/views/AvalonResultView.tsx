// components/avalon/views/AvalonResultView.tsx
'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AvalonPlayer, AvalonAlignment } from '@/types/avalon';
import { ROLE_INFO } from '@/lib/avalonRules';
import { soundManager } from '@/lib/soundManager';

interface AvalonResultViewProps {
  winner: AvalonAlignment | null;
  winReason: string;
  players: AvalonPlayer[];
  onReplay: () => void;
  onReSetup: () => void;
  onBackToLobby: () => void;
}

export const AvalonResultView: React.FC<AvalonResultViewProps> = ({
  winner,
  winReason,
  players,
  onReplay,
  onReSetup,
  onBackToLobby
}) => {
  const isGood = winner === 'GOOD';

  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <div className="view-container view-enter text-center" style={{ paddingBottom: '30px' }}>
      {/* 勝利者標題卡片 */}
      <div
        className="card mb-md"
        style={{
          padding: '24px 16px',
          background: isGood
            ? 'radial-gradient(circle at 50% 30%, rgba(59, 130, 246, 0.3) 0%, rgba(13, 19, 34, 0.95) 80%)'
            : 'radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.3) 0%, rgba(13, 19, 34, 0.95) 80%)',
          border: `2px solid ${isGood ? '#3b82f6' : '#ef4444'}`
        }}
      >
        <span style={{ fontSize: '4rem' }}>{isGood ? '🛡️' : '🗡️'}</span>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', margin: '8px 0 4px' }}>
          {isGood ? '正義陣營 獲勝！' : '邪惡陣營 獲勝！'}
        </h2>
        <p style={{ color: isGood ? '#93c5fd' : '#fca5a5', fontSize: '0.95rem', fontWeight: 600, marginTop: '4px' }}>
          {winReason}
        </p>
      </div>

      {/* 全員真實身份大公開 */}
      <div className="card mb-lg" style={{ padding: '16px', textAlign: 'left' }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', marginBottom: '10px' }}>
          📜 全體玩家真實身份大公開
        </div>
        <div className="flex-col gap-xs">
          {players.map(p => {
            const info = ROLE_INFO[p.role];
            const pIsGood = p.alignment === 'GOOD';
            return (
              <div
                key={p.id}
                className="flex-between"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: pIsGood ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${pIsGood ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>{info.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                      {info.desc.substring(0, 26)}...
                    </div>
                  </div>
                </div>

                <span
                  className="badge"
                  style={{
                    background: pIsGood ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                    color: pIsGood ? '#93c5fd' : '#fca5a5',
                    fontWeight: 800,
                    fontSize: '0.8rem'
                  }}
                >
                  {info.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部按鈕 */}
      <div className="flex-col gap-sm">
        <button
          onClick={() => {
            soundManager.playClick();
            onReplay();
          }}
          className="btn btn-primary btn-large btn-full"
        >
          🔄 同樣配置，再來一局！
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            onReSetup();
          }}
          className="btn btn-secondary btn-full"
        >
          ⚙️ 重新設定人數與角色
        </button>

        <button
          onClick={() => {
            soundManager.playClick();
            onBackToLobby();
          }}
          className="btn-ghost"
          style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginTop: '4px' }}
        >
          ← 返回遊戲大廳
        </button>
      </div>
    </div>
  );
};
