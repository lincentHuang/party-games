// components/lobby/LobbyHeader.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { soundManager } from '@/lib/soundManager';

interface LobbyHeaderProps {
  currentGame: 'LOBBY' | 'SPY' | 'AVALON' | 'WEREWOLF' | 'ROUNDTABLE' | 'ONENIGHT' | 'PLOT' | 'CODEWORD' | 'SIXTH' | 'SONAR' | 'WONDERS';
  onGoLobby: () => void;
}

export const LobbyHeader: React.FC<LobbyHeaderProps> = ({ currentGame, onGoLobby }) => {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(soundManager.getMuted());
  }, []);

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleBackClick = () => {
    if (currentGame !== 'LOBBY') {
      if (confirm('確定要返回遊戲大廳嗎？當前未保存的進度將會重置。')) {
        soundManager.playClick();
        onGoLobby();
      }
    }
  };

  const getGameTitle = () => {
    switch (currentGame) {
      case 'SPY': return '🕵️ 誰是間諜';
      case 'AVALON': return '⚔️ 阿瓦隆';
      case 'WEREWOLF': return '🐺 狼人殺';
      case 'ROUNDTABLE': return '🌕 圓桌狼人';
      case 'ONENIGHT': return '🌙 月夜換牌';
      case 'PLOT': return '👑 宮廷密謀';
      case 'CODEWORD': return '🔐 密語特工';
      case 'SIXTH': return '💥 第六張爆炸';
      case 'SONAR': return '🚀 魚雷遊戲';
      case 'WONDERS': return '🏛️ 七大奇蹟';
      default: return '🎉 聚會桌遊大廳';
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        {currentGame === 'LOBBY' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <span className="dot-status" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem', color: '#ffffff' }}>
              聚會桌遊派對大廳
            </span>
          </div>
        ) : (
          <button
            onClick={handleBackClick}
            className="btn-ghost"
            style={{
              border: 'none',
              padding: '6px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#ffffff',
              fontWeight: 800
            }}
          >
            <span>← 大廳</span>
            <span style={{ color: 'var(--border-card)' }}>|</span>
            <span style={{ color: 'var(--accent-cyan-light)' }}>{getGameTitle()}</span>
          </button>
        )}
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleToggleSound}
          className="btn-icon header-icon-btn"
          title="切換音效"
          style={{ cursor: 'pointer' }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
};
