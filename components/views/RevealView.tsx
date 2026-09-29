'use client';

import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Player, WordPair } from '@/types/game';

interface RevealViewProps {
  player?: Player;
  totalPlayers: number;
  currentIndex: number;
  wordPair: WordPair;
  onNextReveal: () => boolean;
  onCompleteReveal: () => void;
}

export const RevealView: React.FC<RevealViewProps> = ({
  player,
  totalPlayers,
  currentIndex,
  wordPair,
  onNextReveal,
  onCompleteReveal
}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [hasRevealedOnce, setHasRevealedOnce] = useState(false);
  const isHoldingRef = useRef(false);

  useEffect(() => {
    // 當切換到新特工時重置狀態
    setIsHolding(false);
    setHasRevealedOnce(false);
    isHoldingRef.current = false;
  }, [currentIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isHoldingRef.current = true;
    setIsHolding(true);
    soundManager.playFingerprintScan();

    if (!hasRevealedOnce) {
      setHasRevealedOnce(true);
      soundManager.playRevealSecret();
    }
  };

  const handlePointerUp = (e: React.PointerEvent | PointerEvent) => {
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsHolding(false);
    }
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isHoldingRef.current) {
        isHoldingRef.current = false;
        setIsHolding(false);
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  if (!player) {
    return null;
  }

  const isLast = currentIndex === totalPlayers - 1;
  const diffLabel = { easy: '簡單', medium: '中等', hard: '困難' }[wordPair.difficulty] || '中等';

  const handleNextClick = () => {
    soundManager.playClick();
    const hasNext = onNextReveal();
    if (!hasNext) {
      onCompleteReveal();
    }
  };

  return (
    <div className="view-container view-enter" style={{ justifyContent: 'space-between', paddingBottom: '32px' }}>
      {/* 進度指示 */}
      <div className="shrink-0">
        <div className="flex-between mb-sm">
          <span className="badge badge-cyan">特工身分核對</span>
          <span className="text-code text-cyan" style={{ fontSize: '0.9rem', fontWeight: 800 }}>
            {currentIndex + 1} / {totalPlayers}
          </span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ width: `${((currentIndex + 1) / totalPlayers) * 100}%`, height: '100%', background: 'var(--accent-cyan)', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* 特工傳閱防護卡片 */}
      <div className="scanner-card shrink-0">
        <div className="scanner-dossier-header">
          <div style={{ fontSize: '2.8rem', marginBottom: '4px' }}>{player.icon}</div>
          <div className="badge badge-classified mb-sm" style={{ fontSize: '0.8rem' }}>🔒 機密傳閱中 · 請本人操作</div>
          <h2 style={{ fontSize: '1.8rem', color: '#ffffff', fontWeight: 900, margin: '4px 0' }}>
            {player.name}
          </h2>
          <p className="text-code" style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
            CODE: {player.code}
          </p>
        </div>

        {/* AI 特工免手動長按 */}
        {player.isAI ? (
          <div style={{ padding: '16px 8px' }}>
            <div className="badge badge-cyan mb-sm" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
              🤖 電腦 AI 特工已自動載入
            </div>
            <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1.5px dashed rgba(6, 182, 212, 0.4)', borderRadius: 'var(--radius-inner)', padding: '18px 12px', margin: '14px 0' }}>
              <p style={{ fontSize: '0.92rem', color: 'var(--fg-primary)', fontWeight: 600, marginBottom: '6px' }}>
                機密情報已在背景加密完成
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)', margin: 0 }}>
                電腦特工已鎖定詞彙，請直接點擊下方按鈕交給下一位特工。
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 初始未長按狀態 */}
            {!isHolding && (
              <div>
                <p style={{ fontSize: '0.95rem', color: 'var(--fg-primary)', fontWeight: 600, marginBottom: '12px', lineHeight: 1.45 }}>
                  請 {player.name} 本人<br />
                  <strong style={{ color: 'var(--accent-cyan-light)' }}>「長按指紋圖示」</strong>查看秘密詞彙
                </p>

                <div
                  className={`fingerprint-zone ${isHolding ? 'active' : ''}`}
                  onPointerDown={handlePointerDown}
                >
                  <svg className="fingerprint-icon" viewBox="0 0 24 24">
                    <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 5.92 1.5.24.13.33.43.2.67-.08.2-.21.3-.32.3zM3.65 9.63c-.09 0-.19-.02-.28-.07-.24-.13-.32-.43-.19-.67.92-1.63 2.15-2.98 3.66-4.01.23-.16.54-.1.7.13.16.23.1.54-.13.7-1.38.94-2.5 2.17-3.34 3.66-.09.17-.26.26-.42.26zm16.7 0c-.16 0-.33-.09-.42-.26-.84-1.49-1.96-2.72-3.34-3.66-.23-.16-.29-.47-.13-.7.16-.23.47-.29.7-.13 1.51 1.03 2.74 2.38 3.66 4.01.13.24.05.54-.19.67-.09.05-.19.07-.28.07zm-7.66 12.09c-2.3 0-4.32-.8-5.87-2.31-1.63-1.59-2.53-3.77-2.53-6.14 0-4.06 3.48-7.37 7.75-7.37 4.28 0 7.75 3.31 7.75 7.37 0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-3.51-3.03-6.37-6.75-6.37-3.73 0-6.75 2.86-6.75 6.37 0 2.09.79 4.02 2.23 5.42 1.37 1.34 3.17 2.05 5.2 2.05 2.19 0 4.19-.84 5.64-2.36.2-.2.51-.2.71 0 .2.2.2.51 0 .71-1.64 1.72-3.9 2.63-6.38 2.63zm-3.04-3.54c-1.39 0-2.67-.57-3.6-1.57-.99-1.07-1.54-2.53-1.54-4.11 0-2.82 2.4-5.11 5.35-5.11 2.95 0 5.35 2.29 5.35 5.11 0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.27-1.95-4.11-4.35-4.11-2.4 0-4.35 1.84-4.35 4.11 0 1.32.46 2.54 1.29 3.44.78.84 1.85 1.32 3.01 1.32.28 0 .5.22.5.5s-.22.51-.51.51zm8.38 2.92c-.13 0-.26-.05-.35-.15-.2-.2-.2-.51 0-.71 2.28-2.29 3.54-5.38 3.54-8.71 0-.28.22-.5.5-.5s.5.22.5.5c0 3.6-1.36 6.94-3.84 9.42-.1.1-.23.15-.35.15z" />
                  </svg>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                  * 放開螢幕將立即上鎖遮蔽，防止他人偷窺 *
                </p>
              </div>
            )}

            {/* 長按解密顯現區 */}
            {isHolding && (
              <div>
                <div className="badge badge-classified mb-sm">機密情報 · 已解鎖</div>
                <div className="secret-result-box">
                  <div className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan-light)' }}>YOUR SECRET WORD:</div>
                  <div className="secret-word-display">
                    {player.word}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
                    <span className="badge badge-cyan">{wordPair.category}</span>
                    <span className="badge badge-medium">難度：{diffLabel}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fb7185' }}>
                  ⚠️ 請牢記你的詞彙，勿唸出聲！
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部傳遞確認按鈕 */}
      <div className="shrink-0" style={{ marginTop: '20px', paddingBottom: '16px' }}>
        {player.isAI || (hasRevealedOnce && !isHolding) ? (
          <button onClick={handleNextClick} className="btn btn-primary btn-large btn-full">
            {isLast ? '✅ 全員看詞完畢，進入發言階段' : '👉 交給下一位特工'}
          </button>
        ) : (
          <div className="text-center" style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            [ 請先長按上方指紋查看機密詞彙 ]
          </div>
        )}
      </div>

    </div>
  );
};
