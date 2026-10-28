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
      <div className="text-center mb-lg shrink-0">
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
      <div className="flex-col gap-md mb-lg shrink-0">
        {/* 1. 核心首選：每人一支手機 */}
        <button onClick={handleMultiMode} className="card card-hero-highlight shrink-0" style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="flex-between mb-sm">
            <span className="badge badge-cyan">🔥 推薦</span>
            <span style={{ fontSize: '1.6rem' }}>👥</span>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px' }}>
            每人一支手機
          </h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            房主建房，大家掃 QR Code 加入。每個人在自己手機看詞、投票，系統自動計票、判勝負。
          </p>
        </button>

        {/* 2. 單機傳閱 */}
        <button onClick={handleSingleMode} className="card shrink-0" style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="flex-between mb-sm">
            <span className="badge badge-easy">📱 只有一支手機</span>
            <span style={{ fontSize: '1.4rem' }}>🔄</span>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
            單機傳閱
          </h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', lineHeight: 1.45 }}>
            一支手機輪流傳著看詞，也可以加入 AI 玩家一起玩。
          </p>
        </button>

        {/* 3. 題庫庫房與自訂擴充 */}
        <button onClick={handleWordsManage} className="card shrink-0" style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="flex-between mb-sm">
            <span className="badge badge-easy">🗃️ 題庫管理</span>
            <span style={{ fontSize: '1.4rem' }}>📚</span>
          </div>
          <h3 style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px' }}>
            題庫與自訂題目
          </h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', lineHeight: 1.45 }}>
            三段難度題目、自訂題庫、批次匯入匯出。房主的自訂題目也會用在房間對局裡。
          </p>
        </button>
      </div>

      {/* 底部規則指南按鈕 */}
      <div className="flex-center gap-md mt-auto shrink-0">
        <button onClick={handleRules} className="btn btn-secondary shrink-0" style={{ fontSize: '0.9rem', padding: '10px 20px' }}>
          📖 特工行動守則指南
        </button>
      </div>
    </div>
  );
};
