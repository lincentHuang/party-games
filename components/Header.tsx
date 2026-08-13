'use client';

import React, { useState, useEffect } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Phase } from '@/types/game';

interface HeaderProps {
  phase: Phase;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ phase, onGoHome }) => {
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(soundManager.getMuted());
  }, []);

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleLogoClick = () => {
    if (phase !== 'HOME') {
      if (confirm('確定要回到首頁嗎？當前進行中的對局將會重置。')) {
        soundManager.playClick();
        onGoHome();
      }
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          onClick={handleLogoClick}
          className="btn-ghost"
          style={{ border: 'none', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span className="dot-status" />
          <span className="header-title">誰是間諜</span>
        </button>
      </div>
      <div className="header-right">
        <button
          onClick={handleToggleSound}
          className="btn-icon header-icon-btn"
          title="切換音效與震動"
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
};
