// components/wonders/ScoreModal.tsx
'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ScoreSummary } from '@/types/wonders';

interface ScoreModalProps {
  scores: ScoreSummary[] | null;
  onReplay: () => void;
  onBackToLobby: () => void;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  scores,
  onReplay,
  onBackToLobby
}) => {
  useEffect(() => {
    if (scores && scores.length > 0) {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 }
        });
      } catch (e) {
        // ignore
      }
    }
  }, [scores]);

  if (!scores || scores.length === 0) return null;

  const winner = scores[0];

  return (
    <div className="modal-overlay">
      <div className="modal-sheet text-center" style={{ maxWidth: '460px' }}>
        <span style={{ fontSize: '3.6rem' }}>👑</span>
        <h2 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 2px' }}>
          七大奇蹟 · 文明總霸主揭曉！
        </h2>
        <p style={{ color: 'var(--accent-yellow)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px' }}>
          恭喜【{winner.playerName}】以 {winner.totalScore} 分登頂最高榮耀！
        </p>

        {/* 計分明細排行榜 */}
        <div className="flex-col gap-xs mb-md" style={{ textAlign: 'left' }}>
          {scores.map((s, idx) => (
            <div
              key={s.playerId}
              className="card"
              style={{
                padding: '12px 14px',
                background: idx === 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-elevated)',
                border: `1px solid ${idx === 0 ? 'var(--accent-yellow)' : 'var(--border-subtle)'}`
              }}
            >
              <div className="flex-between mb-xs">
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>
                  {idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : '🥉 '}
                  {s.playerName}
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-yellow)' }}>
                  {s.totalScore} 分
                </span>
              </div>

              {/* 細部維度計分小標籤 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '0.72rem', color: 'var(--fg-secondary)' }}>
                <div>⚔️ 軍事: {s.militaryScore}</div>
                <div>💰 國庫: {s.treasuryScore}</div>
                <div>🏛️ 奇蹟: {s.wonderScore}</div>
                <div>🏛️ 市政: {s.civilScore}</div>
                <div>🔬 科技: {s.scienceScore}</div>
                <div>🪙 商業: {s.commercialScore}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-col gap-sm">
          <button onClick={onReplay} className="btn btn-primary btn-large btn-full">
            🔄 再來一局，重寫古代史詩！
          </button>
          <button onClick={onBackToLobby} className="btn btn-secondary btn-full">
            ← 返回遊戲大廳
          </button>
        </div>
      </div>
    </div>
  );
};
