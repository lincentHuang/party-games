'use client';

import React, { useEffect } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Player, Role, WordPair } from '@/types/game';

interface ResultViewProps {
  winner: Role | null;
  wordPair: WordPair;
  players: Player[];
  onReplaySame: () => void;
  onReSetup: () => void;
  onBackHome: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  winner,
  wordPair,
  players,
  onReplaySame,
  onReSetup,
  onBackHome
}) => {
  useEffect(() => {
    if (winner === 'CIVILIAN') {
      soundManager.playVictoryCivilian();
    } else {
      soundManager.playVictorySpy();
    }
  }, [winner]);

  let bannerTitle = '';
  let bannerSub = '';
  let bannerIcon = '';
  let bannerColor = '';

  if (winner === 'CIVILIAN') {
    bannerIcon = '🛡️';
    bannerTitle = '特工平民陣營獲勝！';
    bannerSub = 'CIVILIAN VICTORY · 間諜已全數破獲';
    bannerColor = 'text-emerald';
  } else if (winner === 'SPY') {
    bannerIcon = '⚠️';
    bannerTitle = '間諜臥底大獲全勝！';
    bannerSub = 'SPY VICTORY · 間諜成功掌控特工局';
    bannerColor = 'text-magenta';
  } else {
    bannerIcon = '❓';
    bannerTitle = '白板特工逆襲獲勝！';
    bannerSub = 'BLANK VICTORY · 偽裝到底取得最後勝利';
    bannerColor = 'text-yellow';
  }

  const diffLabel = { easy: '簡單', medium: '中等', hard: '困難' }[wordPair.difficulty] || '中等';

  const handleReplay = () => {
    soundManager.playRevealSecret();
    onReplaySame();
  };

  const handleSetup = () => {
    soundManager.playClick();
    onReSetup();
  };

  const handleHome = () => {
    soundManager.playClick();
    onBackHome();
  };

  return (
    <div className="view-container view-enter">
      {/* 勝利橫幅 */}
      <div className="text-center mb-md">
        <div style={{ fontSize: '3.2rem', marginBottom: '2px' }}>{bannerIcon}</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.1, marginBottom: '4px' }} className={bannerColor}>
          {bannerTitle}
        </h1>
        <p className="text-code text-muted" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>
          {bannerSub}
        </p>
      </div>

      {/* 機密情報詞彙大公開 */}
      <div className="card mb-md" style={{ padding: '16px', borderColor: 'rgba(6, 182, 212, 0.4)' }}>
        <div className="flex-between mb-sm">
          <span className="badge badge-classified">🔥 詞彙真相大公開</span>
          <span className="badge badge-cyan">{wordPair.category} · 難度：{diffLabel}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
          {/* 平民詞 */}
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1.5px solid rgba(16, 185, 129, 0.4)', borderRadius: 'var(--radius-inner)', padding: '12px', textAlign: 'center' }}>
            <div className="text-code text-emerald" style={{ fontSize: '0.72rem', fontWeight: 700 }}>平民特工詞彙</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              {wordPair.civilian}
            </div>
          </div>

          {/* 間諜詞 */}
          <div style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1.5px solid rgba(244, 63, 94, 0.4)', borderRadius: 'var(--radius-inner)', padding: '12px', textAlign: 'center' }}>
            <div className="text-code text-magenta" style={{ fontSize: '0.72rem', fontWeight: 700 }}>間諜臥底詞彙</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
              {wordPair.spy}
            </div>
          </div>
        </div>
      </div>

      {/* 全體特工身分名冊復盤 */}
      <div className="card mb-md" style={{ padding: '14px 16px', flex: 1 }}>
        <div className="flex-between mb-sm">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9rem', color: '#ffffff' }}>全體特工真實檔案</span>
          <span className="text-code text-muted" style={{ fontSize: '0.75rem' }}>對局結束狀態</span>
        </div>
        <div className="flex-col gap-sm overflow-y-auto flex-1 min-h-0" style={{ maxHeight: '220px' }}>
          {players.map(p => (
            <div
              key={p.id}
              className="flex-between shrink-0"
              style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>{p.icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>{p.name}</div>
                  <div className="text-code text-muted" style={{ fontSize: '0.7rem' }}>{p.code}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {p.role === 'SPY' ? (
                  <span className="badge badge-role-spy">間諜</span>
                ) : p.role === 'CIVILIAN' ? (
                  <span className="badge badge-role-civ">平民</span>
                ) : (
                  <span className="badge badge-role-blank">白板</span>
                )}
                {p.isAlive ? (
                  <span className="badge badge-easy" style={{ fontSize: '0.72rem' }}>存活</span>
                ) : (
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>第 {p.eliminatedRound} 輪出局</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部操作按鈕組 */}
      <div className="flex-col gap-sm" style={{ paddingBottom: '8px' }}>
        <button onClick={handleReplay} className="btn btn-primary btn-large btn-full">
          🔄 再來一局 (保留特工名單)
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={handleSetup} className="btn btn-secondary">
            ⚙️ 重新設定
          </button>
          <button onClick={handleHome} className="btn btn-ghost">
            🏠 回首頁
          </button>
        </div>
      </div>
    </div>
  );
};
