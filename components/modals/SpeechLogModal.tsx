'use client';

import React, { useState } from 'react';
import { Player, SpeechLogs } from '@/types/game';
import { soundManager } from '@/lib/soundManager';

interface SpeechLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  speechLogs: SpeechLogs;
  currentRound: number;
}

export const SpeechLogModal: React.FC<SpeechLogModalProps> = ({
  isOpen,
  onClose,
  players,
  speechLogs,
  currentRound
}) => {
  const [selectedRound, setSelectedRound] = useState<number>(currentRound || 1);

  if (!isOpen) return null;

  // 取得目前有紀錄的所有輪次清單
  const recordedRounds = Object.keys(speechLogs)
    .map(Number)
    .filter(r => r > 0)
    .sort((a, b) => a - b);

  const activeRound = recordedRounds.includes(selectedRound)
    ? selectedRound
    : recordedRounds[recordedRounds.length - 1] || currentRound || 1;

  const currentRoundLogs = speechLogs[activeRound] || {};

  const handleClose = () => {
    soundManager.playClick();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-sheet"
        style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 彈窗頭部 */}
        <div className="flex-between mb-sm" style={{ borderBottom: '1px solid var(--border-card)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>📜</span>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: '#ffffff', margin: 0 }}>特工發言速記情報冊</h3>
              <div className="text-code text-cyan" style={{ fontSize: '0.75rem' }}>INTELLIGENCE SPEECH LOGS</div>
            </div>
          </div>
          <button onClick={handleClose} className="btn-icon" style={{ fontSize: '1.2rem', color: 'var(--fg-muted)' }}>
            ✕
          </button>
        </div>

        {/* 輪次切換頁籤 */}
        {recordedRounds.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 0 10px' }}>
            {recordedRounds.map(r => (
              <button
                key={r}
                onClick={() => setSelectedRound(r)}
                className={`chip-btn ${activeRound === r ? 'active' : ''}`}
                style={{ fontSize: '0.8rem', padding: '4px 12px', whiteSpace: 'nowrap' }}
              >
                第 {r} 輪
              </button>
            ))}
          </div>
        )}

        {/* 發言紀錄清單 */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', margin: '8px 0 16px' }} className="flex-col gap-sm">
          {players.map(p => {
            const statement = currentRoundLogs[p.id];
            return (
              <div
                key={p.id}
                style={{
                  background: p.isAlive ? 'var(--bg-elevated)' : 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-inner)',
                  padding: '10px 12px',
                  opacity: p.isAlive ? 1 : 0.6
                }}
              >
                <div className="flex-between mb-xs">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>{p.name}</span>
                    <span className="text-code text-muted" style={{ fontSize: '0.72rem' }}>{p.code}</span>
                    {p.isAI && (
                      <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                        AI
                      </span>
                    )}
                  </div>
                  {!p.isAlive && (
                    <span className="text-magenta" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      [已淘汰]
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '0.88rem',
                    color: statement ? 'var(--fg-primary)' : 'var(--fg-muted)',
                    background: 'rgba(8, 12, 22, 0.5)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontStyle: statement ? 'normal' : 'italic',
                    lineHeight: 1.4
                  }}
                >
                  {statement ? `「${statement}」` : '（本輪尚未記錄發言或無發言）'}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部按鈕 */}
        <button onClick={handleClose} className="btn btn-primary btn-full">
          關閉速記冊
        </button>
      </div>
    </div>
  );
};
