'use client';

import React from 'react';
import { soundManager } from '@/lib/soundManager';
import { GameConfig, Difficulty } from '@/types/game';

interface SetupViewProps {
  config: GameConfig;
  onUpdateConfig: (newConfig: Partial<GameConfig>) => void;
  onBack: () => void;
  onStartGame: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  config,
  onUpdateConfig,
  onBack,
  onStartGame
}) => {
  const calcMaxSpy = (count: number, hasBlank: boolean) => {
    return Math.max(1, Math.floor((count - (hasBlank ? 1 : 0) - 1) / 2));
  };

  const maxSpy = calcMaxSpy(config.playerCount, config.hasBlank);

  const handlePlayerCountChange = (delta: number) => {
    const next = config.playerCount + delta;
    if (next >= 3 && next <= 16) {
      soundManager.playClick();
      const newMaxSpy = calcMaxSpy(next, config.hasBlank);
      onUpdateConfig({
        playerCount: next,
        spyCount: Math.min(config.spyCount, newMaxSpy)
      });
    }
  };

  const handleSpyCountChange = (delta: number) => {
    const next = config.spyCount + delta;
    if (next >= 1 && next <= maxSpy) {
      soundManager.playClick();
      onUpdateConfig({ spyCount: next });
    }
  };

  const handleToggleBlank = (checked: boolean) => {
    soundManager.playClick();
    const newMaxSpy = calcMaxSpy(config.playerCount, checked);
    onUpdateConfig({
      hasBlank: checked,
      spyCount: Math.min(config.spyCount, newMaxSpy)
    });
  };

  const handleToggleDifficulty = (diff: Difficulty) => {
    soundManager.playClick();
    if (config.difficulties.includes(diff)) {
      if (config.difficulties.length > 1) {
        onUpdateConfig({
          difficulties: config.difficulties.filter(d => d !== diff)
        });
      }
    } else {
      onUpdateConfig({
        difficulties: [...config.difficulties, diff]
      });
    }
  };

  const handleSpeechTime = (seconds: number) => {
    soundManager.playClick();
    onUpdateConfig({ speechTime: seconds });
  };

  const handleToggleShowRole = (checked: boolean) => {
    soundManager.playClick();
    onUpdateConfig({ showRoleOnEliminated: checked });
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    const nextNames = [...(config.playerNames || [])];
    nextNames[index] = name;
    onUpdateConfig({ playerNames: nextNames });
  };

  const handleStart = () => {
    soundManager.playRevealSecret();
    onStartGame();
  };

  return (
    <div className="view-container view-enter">
      {/* 頂部標題列 */}
      <div className="flex-between mb-md">
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          ← 返回首頁
        </button>
        <span className="badge badge-cyan">遊戲人數與參數設定</span>
      </div>

      <div className="flex-col gap-md">
        {/* 1. 特工總人數 */}
        <div className="stepper-container">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>特工總人數 (Players)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>支援 3 ~ 16 位玩家</div>
          </div>
          <div className="stepper-controls">
            <button
              onClick={() => handlePlayerCountChange(-1)}
              className="stepper-btn"
              disabled={config.playerCount <= 3}
            >
              -
            </button>
            <span className="stepper-val">{config.playerCount}</span>
            <button
              onClick={() => handlePlayerCountChange(1)}
              className="stepper-btn"
              disabled={config.playerCount >= 16}
            >
              +
            </button>
          </div>
        </div>

        {/* 2. 間諜數量 */}
        <div className="stepper-container">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>間諜人數 (Spies)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-magenta)', fontWeight: 600 }}>潛伏在玩家中的臥底</div>
          </div>
          <div className="stepper-controls">
            <button
              onClick={() => handleSpyCountChange(-1)}
              className="stepper-btn"
              disabled={config.spyCount <= 1}
            >
              -
            </button>
            <span className="stepper-val text-magenta">{config.spyCount}</span>
            <button
              onClick={() => handleSpyCountChange(1)}
              className="stepper-btn"
              disabled={config.spyCount >= maxSpy}
            >
              +
            </button>
          </div>
        </div>

        {/* 3. 白板角色開關 */}
        <div className="toggle-row">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>加入白板特工 (Blank Role)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-yellow)', fontWeight: 600 }}>1 位玩家完全沒有詞彙，全靠推理偽裝</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.hasBlank}
              onChange={(e) => handleToggleBlank(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* 4. 難度等級篩選 */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="flex-between mb-sm">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>題目難度 (可複選)</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>依聚會實力篩課題庫</span>
          </div>
          <div className="filter-group">
            <button
              onClick={() => handleToggleDifficulty('easy')}
              className={`chip-btn chip-easy ${config.difficulties.includes('easy') ? 'active' : ''}`}
            >
              🟢 休閒特訓 (簡單)
            </button>
            <button
              onClick={() => handleToggleDifficulty('medium')}
              className={`chip-btn chip-medium ${config.difficulties.includes('medium') ? 'active' : ''}`}
            >
              🟡 標準行動 (中等)
            </button>
            <button
              onClick={() => handleToggleDifficulty('hard')}
              className={`chip-btn chip-hard ${config.difficulties.includes('hard') ? 'active' : ''}`}
            >
              🔴 絕密諜影 (困難)
            </button>
          </div>
        </div>

        {/* 5. 發言限時 */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="flex-between mb-sm">
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>每位特工發言限時</span>
            <span className="text-code text-cyan" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              {config.speechTime === 0 ? '不限時' : `${config.speechTime} 秒`}
            </span>
          </div>
          <div className="filter-group">
            {[30, 45, 60, 0].map(time => (
              <button
                key={time}
                onClick={() => handleSpeechTime(time)}
                className={`chip-btn ${config.speechTime === time ? 'active' : ''}`}
              >
                {time === 0 ? '不限時' : `${time}秒`}
              </button>
            ))}
          </div>
        </div>

        {/* 6. 淘汰揭曉規則 */}
        <div className="toggle-row">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#ffffff' }}>淘汰直接公布身分 (明牌模式)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>關閉則為「暗牌」，直到遊戲結束才揭曉身分</div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.showRoleOnEliminated}
              onChange={(e) => handleToggleShowRole(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* 自訂玩家暱稱摺疊區 */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-cyan-light)', outline: 'none' }}>
              ✏️ 自訂玩家名稱 (可選，點擊展開)
            </summary>
            <div className="flex-col gap-sm" style={{ marginTop: '12px' }}>
              {Array.from({ length: config.playerCount }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="text-code" style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', width: '68px', fontWeight: 700 }}>
                    P{i + 1}:
                  </span>
                  <input
                    type="text"
                    className="input-text"
                    placeholder={`AGENT ${String(i + 1).padStart(2, '0')}`}
                    value={config.playerNames[i] || ''}
                    onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                  />
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* 底部啟動按鈕 */}
      <div style={{ marginTop: '24px', paddingBottom: '12px' }}>
        <button onClick={handleStart} className="btn btn-primary btn-large btn-full">
          🚀 啟動任務 (發牌看詞)
        </button>
      </div>
    </div>
  );
};
