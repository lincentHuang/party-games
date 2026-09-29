// components/avalon/views/AvalonRoleRevealView.tsx
'use client';

import React, { useState } from 'react';
import { AvalonPlayer } from '@/types/avalon';
import { ROLE_INFO, getPlayerVisions } from '@/lib/avalonRules';
import { soundManager } from '@/lib/soundManager';

interface AvalonRoleRevealViewProps {
  player: AvalonPlayer;
  currentIndex: number;
  totalPlayers: number;
  allPlayers: AvalonPlayer[];
  onNext: () => void;
}

export const AvalonRoleRevealView: React.FC<AvalonRoleRevealViewProps> = ({
  player,
  currentIndex,
  totalPlayers,
  allPlayers,
  onNext
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const info = ROLE_INFO[player.role];
  const visions = getPlayerVisions(player, allPlayers);

  const handleTouchStart = () => {
    soundManager.playFingerprintPress();
    setIsRevealed(true);
  };

  const handleTouchEnd = () => {
    setIsRevealed(false);
  };

  const isLast = currentIndex + 1 >= totalPlayers;

  return (
    <div className="view-container view-enter" style={{ justifyContent: 'center' }}>
      {/* 傳閱提示 */}
      <div className="text-center mb-md">
        <span className="badge badge-classified mb-xs">
          第 {currentIndex + 1} / {totalPlayers} 位玩家
        </span>
        <h2 style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 2px' }}>
          請交給【<span className="text-cyan">{player.name}</span>】
        </h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
          確保其他玩家未偷看螢幕，長按指紋解密機密身份
        </p>
      </div>

      {/* 身份卡片區塊 */}
      <div
        className="card mb-lg"
        style={{
          minHeight: '280px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
          background: isRevealed
            ? player.alignment === 'GOOD'
              ? 'radial-gradient(circle at 50% 30%, rgba(59, 130, 246, 0.25) 0%, rgba(13, 19, 34, 0.95) 75%)'
              : 'radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.25) 0%, rgba(13, 19, 34, 0.95) 75%)'
            : 'var(--bg-card)',
          border: isRevealed
            ? `2px solid ${player.alignment === 'GOOD' ? '#3b82f6' : '#ef4444'}`
            : '1px solid var(--border-card)',
          transition: 'all 0.25s ease'
        }}
      >
        {isRevealed ? (
          <div className="text-center flex-col gap-sm" style={{ width: '100%' }}>
            <span style={{ fontSize: '3.6rem' }}>{info.icon}</span>
            <div>
              <span
                className="badge mb-xs"
                style={{
                  background: player.alignment === 'GOOD' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: player.alignment === 'GOOD' ? '#93c5fd' : '#fca5a5',
                  border: `1px solid ${player.alignment === 'GOOD' ? '#3b82f6' : '#ef4444'}`,
                  fontWeight: 800
                }}
              >
                {player.alignment === 'GOOD' ? '🛡️ 正義陣營 (Loyal Servant)' : '🗡️ 邪惡陣營 (Minion of Mordred)'}
              </span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffffff', margin: '4px 0' }}>
                {info.name}
              </h3>
              <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', lineHeight: 1.45 }}>
                {info.desc}
              </p>
            </div>

            {/* 夜間專屬天眼視覺 */}
            <div
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '12px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px dashed rgba(255, 255, 255, 0.2)',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-yellow)', marginBottom: '4px' }}>
                👁️ 你的專屬夜間視野：
              </div>
              {visions.map((v, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: '#ffffff', lineHeight: 1.4, marginTop: '2px' }}>
                  {v}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center flex-col gap-md">
            <span style={{ fontSize: '4rem', opacity: 0.8 }}>🔐</span>
            <div>
              <div style={{ color: '#ffffff', fontSize: '1.15rem', fontWeight: 800 }}>
                絕密身份封印中
              </div>
              <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                按住下方按鈕解密，放開即自動遮蔽
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 按鈕操作 */}
      <div className="flex-col gap-sm">
        <button
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="btn btn-primary btn-large btn-full"
          style={{
            userSelect: 'none',
            background: isRevealed ? 'var(--accent-magenta)' : 'var(--accent-cyan)',
            color: '#080c16',
            fontWeight: 800,
            fontSize: '1.1rem'
          }}
        >
          {isRevealed ? '👀 鬆開隱藏身份' : '👆 長按此處檢視身份'}
        </button>

        <button
          onClick={onNext}
          className="btn btn-secondary btn-full"
          style={{ fontSize: '0.95rem' }}
        >
          {isLast ? '✅ 全員確認完畢，開始第 1 輪任務' : '➡️ 我記住了，交給下一位玩家'}
        </button>
      </div>
    </div>
  );
};
