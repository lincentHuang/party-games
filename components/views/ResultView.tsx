'use client';

import React, { useEffect } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Player, Role, WordPair, SpeechLogs } from '@/types/game';

interface ResultViewProps {
  winner: Role | null;
  wordPair: WordPair;
  players: Player[];
  speechLogs?: SpeechLogs;
  onReplaySame: () => void;
  onReSetup: () => void;
  onBackHome: () => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  winner,
  wordPair,
  players,
  speechLogs = {},
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
      <div className="text-center mb-sm shrink-0">
        <div style={{ fontSize: '2.8rem', marginBottom: '2px' }}>{bannerIcon}</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 900, lineHeight: 1.1, marginBottom: '4px' }} className={bannerColor}>
          {bannerTitle}
        </h1>
        <p className="text-code text-muted" style={{ fontSize: '0.78rem', letterSpacing: '1px' }}>
          {bannerSub}
        </p>
      </div>

      {/* 機密情報詞彙大公開 */}
      <div className="card mb-sm shrink-0" style={{ padding: '12px 14px', borderColor: 'rgba(6, 182, 212, 0.4)' }}>
        <div className="flex-between mb-xs">
          <span className="badge badge-classified">🔥 詞彙真相大公開</span>
          <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>{wordPair.category} · 難度：{diffLabel}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
          {/* 平民詞 */}
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1.5px solid rgba(16, 185, 129, 0.4)', borderRadius: 'var(--radius-inner)', padding: '10px 8px', textAlign: 'center' }}>
            <div className="text-code text-emerald" style={{ fontSize: '0.7rem', fontWeight: 700 }}>平民特工詞彙</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
              {wordPair.civilian}
            </div>
          </div>

          {/* 間諜詞 */}
          <div style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1.5px solid rgba(244, 63, 94, 0.4)', borderRadius: 'var(--radius-inner)', padding: '10px 8px', textAlign: 'center' }}>
            <div className="text-code text-magenta" style={{ fontSize: '0.7rem', fontWeight: 700 }}>間諜臥底詞彙</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
              {wordPair.spy}
            </div>
          </div>
        </div>
      </div>

      {/* 全體特工身分名冊復盤 */}
      <div className="card mb-sm" style={{ padding: '12px 14px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between mb-xs">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.88rem', color: '#ffffff' }}>全體特工檔案與發言復盤</span>
          <span className="text-code text-muted" style={{ fontSize: '0.72rem' }}>終局復盤</span>
        </div>
        <div className="flex-col gap-xs overflow-y-auto flex-1 min-h-0" style={{ maxHeight: '200px' }}>
          {players.map(p => {
            // 抓取該玩家在各輪的發言
            const playerSpeeches = Object.keys(speechLogs)
              .map(Number)
              .map(r => ({ round: r, text: speechLogs[r]?.[p.id] }))
              .filter(item => Boolean(item.text));

            return (
              <div
                key={p.id}
                className="shrink-0"
                style={{ background: 'var(--bg-elevated)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                        {p.name}
                        {p.isAI && (
                          <span className="badge badge-cyan" style={{ fontSize: '0.62rem', marginLeft: '6px', padding: '1px 5px' }}>
                            AI
                          </span>
                        )}
                      </div>
                      <div className="text-code text-muted" style={{ fontSize: '0.68rem' }}>{p.code}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {p.role === 'SPY' ? (
                      <span className="badge badge-role-spy" style={{ fontSize: '0.72rem' }}>間諜</span>
                    ) : p.role === 'CIVILIAN' ? (
                      <span className="badge badge-role-civ" style={{ fontSize: '0.72rem' }}>平民</span>
                    ) : (
                      <span className="badge badge-role-blank" style={{ fontSize: '0.72rem' }}>白板</span>
                    )}
                    {p.isAlive ? (
                      <span className="badge badge-easy" style={{ fontSize: '0.68rem' }}>存活</span>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.7rem' }}>第 {p.eliminatedRound} 輪出局</span>
                    )}
                  </div>
                </div>

                {/* 該玩家的發言速記展示 */}
                {playerSpeeches.length > 0 && (
                  <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed rgba(255, 255, 255, 0.08)' }}>
                    {playerSpeeches.map(s => (
                      <div key={s.round} style={{ fontSize: '0.78rem', color: 'var(--fg-secondary)', lineHeight: 1.35, marginTop: '2px' }}>
                        <span className="text-cyan" style={{ fontWeight: 600 }}>[R{s.round}]</span> 「{s.text}」
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部操作按鈕組 */}
      <div className="flex-col gap-sm shrink-0" style={{ paddingBottom: '8px' }}>
        <button onClick={handleReplay} className="btn btn-primary btn-large btn-full shrink-0">
          🔄 再來一局 (保留特工名單)
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={handleSetup} className="btn btn-secondary shrink-0">
            ⚙️ 重新設定
          </button>
          <button onClick={handleHome} className="btn btn-ghost shrink-0">
            🏠 回首頁
          </button>
        </div>
      </div>
    </div>
  );
};
