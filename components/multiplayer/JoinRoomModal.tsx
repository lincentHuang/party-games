// components/multiplayer/JoinRoomModal.tsx
'use client';

import React, { useState } from 'react';
import { soundManager } from '@/lib/soundManager';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomId: string, playerName?: string) => Promise<boolean>;
  initialPlayerName?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoin,
  initialPlayerName = ''
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState(initialPlayerName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setErrorMsg('請輸入房間代碼');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    soundManager.playClick();

    const ok = await onJoin(roomCode.trim().toUpperCase(), name.trim());
    setIsSubmitting(false);

    if (!ok) {
      setErrorMsg('加入房間失敗，請確認代碼是否正確');
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>
            🔑 加入多人房間
          </div>
          <button onClick={onClose} className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body flex-col gap-md">
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', display: 'block', marginBottom: '6px' }}>
              你的暱稱
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="輸入你的遊戲暱稱"
              maxLength={12}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-card)',
                background: 'var(--bg-elevated)',
                color: '#ffffff',
                fontSize: '1rem'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', display: 'block', marginBottom: '6px' }}>
              房間代碼 (如 SONAR-1234)
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              placeholder="例如：SONAR-1234"
              autoFocus
              maxLength={15}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-card)',
                background: 'var(--bg-elevated)',
                color: 'var(--accent-cyan-light)',
                fontFamily: 'var(--font-code)',
                fontSize: '1.2rem',
                fontWeight: 700,
                letterSpacing: '1px'
              }}
            />
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--accent-magenta)', fontSize: '0.85rem', fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="flex-col gap-sm" style={{ marginTop: '8px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-large btn-full"
            >
              {isSubmitting ? '連線中...' : '🚀 加入房間'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-full"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
