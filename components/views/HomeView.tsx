'use client';

import React from 'react';
import { soundManager } from '@/lib/soundManager';
import { Phase } from '@/types/game';

interface HomeViewProps {
  onSelectPhase: (phase: Phase) => void;
  onOpenRules: () => void;
  onOpenMultiplayer: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectPhase,
  onOpenRules,
  onOpenMultiplayer
}) => {
  const handleSingleMode = () => {
    soundManager.playClick();
    onSelectPhase('SETUP');
  };

  const handleWordsManage = () => {
    soundManager.playClick();
    onSelectPhase('WORDS');
  };

  const handleMultiMode = () => {
    soundManager.playClick();
    onOpenMultiplayer();
  };

  const handleRules = () => {
    soundManager.playClick();
    onOpenRules();
  };

  return (
    <div className="view-container view-enter" style={{ justifyContent: 'center' }}>
      {/* Hero 主標題區 */}
      <div className="text-center mb-lg">
        <span className="badge badge-classified mb-sm">
          PARTY BOARD GAME
        </span>
        <h1 style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1.1, margin: '6px 0 8px' }}>
          誰是<span className="text-magenta">間諜</span>
        </h1>
        <p className="text-code text-cyan" style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1.5px' }}>
          WHO IS THE SPY
        </p>
      </div>

      {/* 模式選單卡片 */}
      <div className="flex-col gap-md mb-lg">
        {/* 1. 核心首選：單機傳閱派對模式 */}
        <button onClick={handleSingleMode} className="card card-hero-highlight" style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="flex-between mb-sm">
            <span className="badge badge-cyan">🔥 推薦首選模式</span>
            <span style={{ fontSize: '1.6rem' }}>📱</span>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>
            單機派對傳閱 (Pass & Play)
          </h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            只需一台手機！輪流長按指紋看詞，內建法官主持、發言計時、投票放逐與終局復盤。
          </p>
        </button>

        {/* 2. 次要功能：題庫庫房與自訂擴充 */}
        <button onClick={handleWordsManage} className="card" style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="flex-between mb-sm">
            <span className="badge badge-easy">🗃️ 題庫管理</span>
            <span style={{ fontSize: '1.4rem' }}>📚</span>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
            題庫庫房與難度自訂
          </h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', lineHeight: 1.45 }}>
            三段難度題目（簡單/中等/困難）、自訂題庫、一鍵多行批次快速匯入/匯出。
          </p>
        </button>

        {/* 3. 預留功能：多人房間連線 */}
        <button onClick={handleMultiMode} className="card" style={{ textAlign: 'left', cursor: 'pointer', opacity: 0.85 }}>
          <div className="flex-between mb-sm">
            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--fg-muted)' }}>📡 模組預覽</span>
            <span style={{ fontSize: '1.4rem' }}>👥</span>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
            多手機房間連線 (Multi-Device)
          </h3>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', lineHeight: 1.45 }}>
            每人各自使用手機掃碼入房同步看詞。（已預留架構接口，可點擊查看規劃）
          </p>
        </button>
      </div>

      {/* 底部規則指南按鈕 */}
      <div className="flex-center gap-md mt-auto">
        <button onClick={handleRules} className="btn btn-secondary" style={{ fontSize: '0.9rem', padding: '10px 20px' }}>
          📖 特工行動守則指南
        </button>
      </div>
    </div>
  );
};
