// components/lobby/GameLobbyView.tsx
'use client';

import React, { useState } from 'react';
import { soundManager } from '@/lib/soundManager';

interface GameLobbyViewProps {
  onSelectGame: (game: 'SPY' | 'AVALON' | 'SONAR' | 'WONDERS') => void;
  onOpenJoinModal: () => void;
}

export const GameLobbyView: React.FC<GameLobbyViewProps> = ({
  onSelectGame,
  onOpenJoinModal
}) => {
  const [filter, setFilter] = useState<'ALL' | 'HOT' | 'DEDUCTION' | 'TACTICAL' | 'STRATEGY' | 'QR'>('ALL');

  const games = [
    {
      id: 'SPY' as const,
      title: '誰是間諜',
      subtitle: 'WHO IS THE SPY',
      icon: '🕵️',
      accentClass: 'game-card-accent-spy',
      category: ['ALL', 'HOT', 'DEDUCTION'],
      playerTag: '3 - 12 人 · 心戰推理',
      badges: ['🔥 聚會首選', '📱 單機傳閱', '🎙️ AI語音計時'],
      desc: '平民與臥底間諜的暗度陳倉對抗！專利指紋長按防窺看詞，內建法官倒數主持、發言日誌與放逐復盤。',
      btnText: '開始誰是間諜',
      hasQr: false
    },
    {
      id: 'AVALON' as const,
      title: '阿瓦隆',
      subtitle: 'THE RESISTANCE: AVALON',
      icon: '⚔️',
      accentClass: 'game-card-accent-avalon',
      category: ['ALL', 'HOT', 'DEDUCTION', 'QR'],
      playerTag: '5 - 10 人 · 經典身份桌遊',
      badges: ['👑 必玩陣營', '🧙‍♂️ 梅林先知', '🗡️ 刺殺逆轉', '📡 支援掃碼'],
      desc: '亞瑟王的正義騎士遠征聖杯！梅林、派西維爾暗護國度，莫甘娜、莫德雷德與刺客步步進逼，好人滿勝還有刺殺梅林逆轉勝！',
      btnText: '進入阿瓦隆',
      hasQr: true
    },
    {
      id: 'SONAR' as const,
      title: '魚雷遊戲',
      subtitle: 'SONAR DUEL · 深海潛艇對抗',
      icon: '🚀',
      accentClass: 'game-card-accent-sonar',
      category: ['ALL', 'HOT', 'TACTICAL', 'QR'],
      playerTag: '2 - 8 人 · 雙艦雷達海戰',
      badges: ['📡 QR Code 掃碼對戰', '🎯 定點魚雷', '🌊 聲納探測', '🤖 支援AI'],
      desc: '紅藍潛艦潛入迷霧深海！手機掃描 QR Code 即時連線，舵手航向移動、大副充能系統、聲納探測敵艦座標並發射致命魚雷！',
      btnText: '📡 掃碼對戰 (魚雷遊戲)',
      hasQr: true
    },
    {
      id: 'WONDERS' as const,
      title: '7大奇蹟',
      subtitle: '7 WONDERS · 建築風雲',
      icon: '🏛️',
      accentClass: 'game-card-accent-wonders',
      category: ['ALL', 'HOT', 'STRATEGY', 'QR'],
      playerTag: '2 - 7 人 · 文明卡牌輪抽',
      badges: ['📡 QR Code 掃碼對戰', '🎴 三大時代輪抽', '⚔️ 軍事衝突', '🗿 奇蹟修造'],
      desc: '穿越古代三大時代！選擇吉薩金字塔、羅德島巨像等奇蹟，輪抽卡牌興建原料、市政、科技與軍事建築，掃碼多人同步決戰霸主！',
      btnText: '📡 掃碼對戰 (7大奇蹟)',
      hasQr: true
    }
  ];

  const filteredGames = games.filter(g => {
    if (filter === 'ALL') return true;
    if (filter === 'HOT') return g.category.includes('HOT');
    if (filter === 'DEDUCTION') return g.category.includes('DEDUCTION');
    if (filter === 'TACTICAL') return g.category.includes('TACTICAL');
    if (filter === 'STRATEGY') return g.category.includes('STRATEGY');
    if (filter === 'QR') return g.category.includes('QR');
    return true;
  });

  return (
    <div className="view-container view-enter" style={{ paddingBottom: '36px' }}>
      {/* 頂部 Hero 派對大廳橫幅 */}
      <div className="lobby-hero mb-md">
        <span className="badge badge-classified mb-xs">
          MULTIPLAYER PARTY GAMES HUB
        </span>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 900, lineHeight: 1.15, margin: '4px 0 6px' }}>
          聚會派對<span className="text-cyan">遊戲大廳</span>
        </h1>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', lineHeight: 1.45 }}>
          手機開瀏覽器即玩 · 支援 <strong>QR Code 掃碼雙向連線</strong> 與 <strong>單機指紋傳閱</strong>
        </p>

        {/* 快速加入房間捷徑 */}
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenJoinModal();
            }}
            className="btn btn-secondary"
            style={{
              width: '100%',
              fontSize: '0.88rem',
              fontWeight: 800,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <span>🔑 輸入房間代碼加入對戰</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan-light)' }}>
              (支援跨手機連線)
            </span>
          </button>
        </div>
      </div>

      {/* 分類篩選標籤 */}
      <div className="lobby-filter-row mb-md">
        {[
          { key: 'ALL', label: '全部遊戲 (4)' },
          { key: 'HOT', label: '🔥 熱門推薦' },
          { key: 'QR', label: '📡 掃碼對戰' },
          { key: 'DEDUCTION', label: '⚔️ 陣營心戰' },
          { key: 'TACTICAL', label: '🚀 即時海戰' },
          { key: 'STRATEGY', label: '🏛️ 文明輪抽' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => {
              soundManager.playClick();
              setFilter(item.key as any);
            }}
            className={`filter-chip ${filter === item.key ? 'filter-chip-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 遊戲列表卡片清單 */}
      <div className="flex-col gap-md">
        {filteredGames.map(game => (
          <div key={game.id} className={`game-card ${game.accentClass}`}>
            {/* 卡片標題與圖標 */}
            <div className="flex-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '2.4rem' }}>{game.icon}</span>
                <div>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                    {game.title}
                  </h3>
                  <div className="text-code text-cyan" style={{ fontSize: '0.72rem', letterSpacing: '1px' }}>
                    {game.subtitle}
                  </div>
                </div>
              </div>

              <span className="badge badge-cyan" style={{ fontSize: '0.78rem' }}>
                {game.playerTag}
              </span>
            </div>

            {/* 特色標籤列表 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {game.badges.map((b, i) => (
                <span
                  key={i}
                  className="badge"
                  style={{
                    background: b.includes('QR') ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.08)',
                    color: b.includes('QR') ? 'var(--accent-cyan-light)' : 'var(--fg-secondary)',
                    border: b.includes('QR') ? '1px solid rgba(6, 182, 212, 0.4)' : undefined,
                    fontSize: '0.75rem'
                  }}
                >
                  {b}
                </span>
              ))}
            </div>

            {/* 遊戲說明 */}
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', lineHeight: 1.5, margin: '2px 0' }}>
              {game.desc}
            </p>

            {/* 進入遊戲主按鈕 */}
            <button
              onClick={() => {
                soundManager.playClick();
                onSelectGame(game.id);
              }}
              className="btn btn-primary btn-large btn-full"
              style={{
                marginTop: '4px',
                fontWeight: 900,
                fontSize: '1rem',
                background: game.id === 'SPY' ? 'linear-gradient(135deg, var(--accent-magenta), #be123c)' :
                            game.id === 'AVALON' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' :
                            game.id === 'SONAR' ? 'linear-gradient(135deg, #10b981, #047857)' :
                            'linear-gradient(135deg, #f59e0b, #b45309)'
              }}
            >
              {game.btnText}
            </button>
          </div>
        ))}
      </div>

      {/* 底部說明 */}
      <div className="text-center mt-lg" style={{ color: 'var(--fg-muted)', fontSize: '0.78rem' }}>
        聚會桌遊大廳 · 打造最順暢的台灣聚會即玩手遊體驗
      </div>
    </div>
  );
};
