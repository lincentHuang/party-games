// components/avalon/views/AvalonSetupView.tsx
'use client';

import React from 'react';
import { AvalonConfig } from '@/types/avalon';
import { ALIGNMENT_COUNT_BY_PLAYERS, ROLE_INFO } from '@/lib/avalonRules';
import { soundManager } from '@/lib/soundManager';

interface AvalonSetupViewProps {
  config: AvalonConfig;
  onUpdateConfig: (newConfig: AvalonConfig) => void;
  onStartGame: () => void;
  onOpenRoomModal: () => void;
  onBack: () => void;
}

export const AvalonSetupView: React.FC<AvalonSetupViewProps> = ({
  config,
  onUpdateConfig,
  onStartGame,
  onOpenRoomModal,
  onBack
}) => {
  const alignment = ALIGNMENT_COUNT_BY_PLAYERS[config.playerCount] || { good: 3, evil: 2 };

  const handlePlayerCountChange = (count: number) => {
    soundManager.playClick();
    const newNames = [...config.playerNames];
    while (newNames.length < count) {
      newNames.push(`玩家 ${newNames.length + 1}`);
    }
    onUpdateConfig({
      ...config,
      playerCount: count,
      playerNames: newNames.slice(0, count)
    });
  };

  const handleNameChange = (idx: number, name: string) => {
    const updated = [...config.playerNames];
    updated[idx] = name;
    onUpdateConfig({ ...config, playerNames: updated });
  };

  return (
    <div className="view-container view-enter" style={{ paddingBottom: '30px' }}>
      {/* 標題與簡介 */}
      <div className="text-center mb-md">
        <span className="badge badge-cyan mb-xs">5 - 10 人 社交推理神作</span>
        <h2 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#ffffff', margin: '4px 0 6px' }}>
          ⚔️ 阿瓦隆設定
        </h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
          正義圓桌騎士 vs 邪惡莫甘娜爪牙，聖杯遠征即將展開
        </p>
      </div>

      {/* 人數設定卡片 */}
      <div className="card mb-md" style={{ padding: '16px' }}>
        <div className="flex-between mb-sm">
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>👥 參戰人數選擇</span>
          <span className="badge badge-cyan" style={{ fontSize: '0.85rem' }}>
            正義 {alignment.good} 人 / 邪惡 {alignment.evil} 人
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
          {[5, 6, 7, 8, 9, 10].map(cnt => (
            <button
              key={cnt}
              onClick={() => handlePlayerCountChange(cnt)}
              className="btn"
              style={{
                padding: '10px 0',
                background: config.playerCount === cnt ? 'var(--accent-cyan)' : 'var(--bg-elevated)',
                color: config.playerCount === cnt ? '#080c16' : '#ffffff',
                fontWeight: 800,
                borderRadius: '10px',
                border: '1px solid ' + (config.playerCount === cnt ? 'var(--accent-cyan-light)' : 'var(--border-subtle)')
              }}
            >
              {cnt} 人
            </button>
          ))}
        </div>
      </div>

      {/* 特殊角色擴充配置 */}
      <div className="card mb-md" style={{ padding: '16px' }}>
        <div className="flex-between mb-sm">
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>✨ 特殊角色擴充</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>點擊切換配置</span>
        </div>
        <div className="flex-col gap-sm">
          {/* 梅林與刺客 (必備) */}
          <div className="flex-between" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🧙‍♂️🗡️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>梅林 & 刺客（核心必備）</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>全知先知與終局逆轉刺客</div>
              </div>
            </div>
            <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>必選</span>
          </div>

          {/* 派西維爾 & 莫甘娜 (強烈推薦綁定) */}
          <div
            onClick={() => {
              soundManager.playClick();
              const nextVal = !config.usePercival;
              onUpdateConfig({ ...config, usePercival: nextVal, useMorgana: nextVal });
            }}
            className="flex-between"
            style={{
              padding: '8px 12px',
              background: config.usePercival ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${config.usePercival ? 'var(--accent-cyan)' : 'transparent'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🛡️🦹‍♀️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>派西維爾 + 莫甘娜（推薦）</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>雙真假先知對決，護航核心</div>
              </div>
            </div>
            <span className="badge" style={{ background: config.usePercival ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)', color: config.usePercival ? '#080c16' : '#fff' }}>
              {config.usePercival ? '啟用' : '關閉'}
            </span>
          </div>

          {/* 莫德雷德 */}
          <div
            onClick={() => {
              soundManager.playClick();
              onUpdateConfig({ ...config, useMordred: !config.useMordred });
            }}
            className="flex-between"
            style={{
              padding: '8px 12px',
              background: config.useMordred ? 'rgba(244, 63, 94, 0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${config.useMordred ? 'var(--accent-magenta)' : 'transparent'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>👿</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>莫德雷德（邪惡首領）</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>對梅林隱藏身份的叛軍首領</div>
              </div>
            </div>
            <span className="badge" style={{ background: config.useMordred ? 'var(--accent-magenta)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              {config.useMordred ? '啟用' : '關閉'}
            </span>
          </div>

          {/* 奧伯倫 */}
          <div
            onClick={() => {
              soundManager.playClick();
              onUpdateConfig({ ...config, useOberon: !config.useOberon });
            }}
            className="flex-between"
            style={{
              padding: '8px 12px',
              background: config.useOberon ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${config.useOberon ? 'var(--accent-yellow)' : 'transparent'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🧚</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>奧伯倫（邪惡孤狼）</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>不與邪惡互認，但梅林看得見他</div>
              </div>
            </div>
            <span className="badge" style={{ background: config.useOberon ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.1)', color: config.useOberon ? '#080c16' : '#fff' }}>
              {config.useOberon ? '啟用' : '關閉'}
            </span>
          </div>
        </div>
      </div>

      {/* 玩家名稱清單 */}
      <div className="card mb-lg" style={{ padding: '16px' }}>
        <div className="flex-between mb-sm">
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>📝 玩家稱號設定</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {config.playerNames.map((name, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', width: '22px' }}>{idx + 1}.</span>
              <input
                type="text"
                value={name}
                onChange={e => handleNameChange(idx, e.target.value)}
                maxLength={10}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 行動按鈕 */}
      <div className="flex-col gap-sm">
        <button
          onClick={onStartGame}
          className="btn btn-primary btn-large btn-full"
          style={{ fontSize: '1.05rem', fontWeight: 800 }}
        >
          📱 單機傳閱開始遊戲 (Pass & Play)
        </button>

        <button
          onClick={onOpenRoomModal}
          className="btn btn-secondary btn-full"
          style={{ fontSize: '0.95rem', fontWeight: 700 }}
        >
          📡 建立 QR Code 多人連線房間
        </button>

        <button
          onClick={onBack}
          className="btn-ghost"
          style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--fg-muted)', marginTop: '4px' }}
        >
          ← 返回遊戲大廳
        </button>
      </div>
    </div>
  );
};
