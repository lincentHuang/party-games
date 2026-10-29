// components/lobby/GameLobbyView.tsx
'use client';

import React, { useState } from 'react';
import { soundManager } from '@/lib/soundManager';

interface GameLobbyViewProps {
  onSelectGame: (game: 'SPY' | 'AVALON' | 'WEREWOLF' | 'ROUNDTABLE' | 'ONENIGHT' | 'PLOT' | 'CODEWORD' | 'SIXTH' | 'SONAR' | 'WONDERS') => void;
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
      badges: ['🔥 聚會首選', '📡 QR Code 每人一支手機', '📱 也能單機傳閱'],
      desc: '平民與臥底間諜的心理戰！每個人用自己的手機看詞、投票，大家面對面描述，系統自動計票判勝負。',
      btnText: '開始誰是間諜',
      hasQr: true,
      hidden: false
    },
    {
      id: 'AVALON' as const,
      title: '阿瓦隆',
      subtitle: 'THE RESISTANCE: AVALON',
      icon: '⚔️',
      accentClass: 'game-card-accent-avalon',
      category: ['ALL', 'HOT', 'DEDUCTION', 'QR'],
      playerTag: '5 - 10 人 · 陣營推理',
      badges: ['📡 QR Code 每人一支手機', '🧙‍♂️ 梅林先知', '🗡️ 刺殺逆轉', '🌊 湖中仙女'],
      desc: '亞瑟王的騎士出征聖杯！每個人用手機看身分、秘密投票組隊、暗中出任務，大家吵誰是壞人就好。好人三勝後還有刺客刺殺梅林的逆轉！',
      btnText: '進入阿瓦隆',
      hasQr: true,
      hidden: false
    },
    {
      id: 'WEREWOLF' as const,
      title: '狼人殺',
      subtitle: 'WEREWOLF · 手機當法官',
      icon: '🐺',
      accentClass: 'game-card-accent-werewolf',
      category: ['ALL', 'HOT', 'DEDUCTION', 'QR'],
      playerTag: '6 - 12 人 · 天黑請閉眼',
      badges: ['📡 QR Code 每人一支手機', '🤖 不用真人法官', '🔮 預言家・女巫・獵人・守衛'],
      desc: '手機自動當法官：夜晚每個人都在自己手機上行動，狼人同步選刀、神職秘密施法，天亮宣告死訊，白天輪流發言投票放逐。所有人都能下場玩！',
      btnText: '進入狼人殺',
      hasQr: true,
      hidden: false
    },
    {
      id: 'ROUNDTABLE' as const,
      title: '圓桌狼人',
      subtitle: 'AVALON × WEREWOLF · 融合版',
      icon: '🌕',
      accentClass: 'game-card-accent-roundtable',
      category: ['ALL', 'HOT', 'DEDUCTION', 'QR'],
      playerTag: '5 - 10 人 · 白天出征夜晚獵殺',
      badges: ['🆕 原創融合玩法', '📡 QR Code 每人一支手機', '⚔️ 組隊出任務', '🌙 任務成功夜狼報復'],
      desc: '白天像阿瓦隆組隊出任務，夜晚像狼人殺：任務成功的那晚狼人會報復殺人，預言家逐夜查驗、守衛擋刀。好人三勝後，狼人還能獵殺預言家逆轉！',
      btnText: '進入圓桌狼人',
      hasQr: true,
      hidden: false
    },
    {
      id: 'ONENIGHT' as const,
      title: '月夜換牌',
      subtitle: 'ONE NIGHT · 一夜決勝',
      icon: '🌙',
      accentClass: 'game-card-accent-onenight',
      category: ['ALL', 'HOT', 'DEDUCTION', 'QR'],
      playerTag: '3 - 10 人 · 一局 10 分鐘',
      badges: ['🆕 新遊戲', '📡 QR Code 每人一支手機', '🔄 夜晚偷換身分', '🤖 可加電腦'],
      desc: '只有一個夜晚！強盜搶牌、搗蛋鬼偷換別人的身分，天亮後連你自己都不確定還是不是原本的角色。討論幾分鐘後一次投票，抓到狼就贏。',
      btnText: '進入月夜換牌',
      hasQr: true,
      hidden: false
    },
    {
      id: 'PLOT' as const,
      title: '宮廷密謀',
      subtitle: 'COURT PLOT · 吹牛奪權',
      icon: '👑',
      accentClass: 'game-card-accent-plot',
      category: ['ALL', 'HOT', 'STRATEGY', 'QR'],
      playerTag: '2 - 6 人 · 人少也能玩',
      badges: ['🆕 新遊戲', '📡 QR Code 每人一支手機', '🎭 吹牛與質疑', '🤖 可加電腦'],
      desc: '手上兩張暗牌，想用什麼角色的能力就直接宣稱——反正沒人看得到。被質疑抓包就失去一張牌，兩張都沒了就出局，活到最後的人奪下王位。',
      btnText: '進入宮廷密謀',
      hasQr: true,
      hidden: false
    },
    {
      id: 'CODEWORD' as const,
      title: '密語特工',
      subtitle: 'CODEWORD · 紅藍分隊猜詞',
      icon: '🔐',
      accentClass: 'game-card-accent-codeword',
      category: ['ALL', 'HOT', 'TACTICAL', 'QR'],
      playerTag: '4 - 12 人 · 分隊對戰',
      badges: ['🆕 新遊戲', '📡 QR Code 每人一支手機', '🗺️ 隊長看得到答案', '💀 小心刺客'],
      desc: '紅藍兩隊，隊長手機上有 25 個詞的答案地圖，只能給「一個詞＋數字」當提示，讓隊友猜出自己隊的特工。翻到刺客直接輸！',
      btnText: '進入密語特工',
      hasQr: true,
      hidden: false
    },
    {
      id: 'SIXTH' as const,
      title: '第六張爆炸',
      subtitle: 'SIXTH CARD · 同時出牌',
      icon: '💥',
      accentClass: 'game-card-accent-sixth',
      category: ['ALL', 'STRATEGY', 'QR'],
      playerTag: '2 - 10 人 · 規則一分鐘學會',
      badges: ['🆕 新遊戲', '📡 QR Code 每人一支手機', '🃏 大家同時出牌', '🤖 可加電腦'],
      desc: '所有人同時出一張數字牌，由小到大排進桌上四列。誰放下了某一列的第六張，就得把整列炸彈收下來！炸彈最少的人獲勝，長輩小孩都能玩。',
      btnText: '進入第六張爆炸',
      hasQr: true,
      hidden: false
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
      hasQr: true,
      // 重啟期間先隱藏，等改成多手機版再開放
      hidden: true
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
      hasQr: true,
      // 重啟期間先隱藏，等改成多手機版再開放
      hidden: true
    }
  ];

  const visibleGames = games.filter(g => !g.hidden);
  const filteredGames = visibleGames.filter(g => {
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

      {/* 分類篩選標籤（遊戲超過三款才顯示） */}
      {visibleGames.length > 3 && (
      <div className="lobby-filter-row mb-md">
        {[
          { key: 'ALL', label: `全部遊戲 (${visibleGames.length})` },
          { key: 'HOT', label: '🔥 熱門推薦' },
          { key: 'DEDUCTION', label: '⚔️ 陣營心戰' },
          { key: 'STRATEGY', label: '🃏 卡牌對戰' },
          { key: 'TACTICAL', label: '👥 分隊猜詞' }
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
      )}

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
                            game.id === 'WEREWOLF' ? 'linear-gradient(135deg, #7c3aed, #4c1d95)' :
                            game.id === 'ROUNDTABLE' ? 'linear-gradient(135deg, #0ea5e9, #6d28d9)' :
                            game.id === 'ONENIGHT' ? 'linear-gradient(135deg, #6366f1, #1e1b4b)' :
                            game.id === 'PLOT' ? 'linear-gradient(135deg, #eab308, #a16207)' :
                            game.id === 'CODEWORD' ? 'linear-gradient(135deg, #ef4444, #2563eb)' :
                            game.id === 'SIXTH' ? 'linear-gradient(135deg, #f97316, #c2410c)' :
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
