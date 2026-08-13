'use client';

import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Player } from '@/types/game';

interface PlayViewProps {
  round: number;
  totalPlayers: number;
  speechTime: number;
  currentSpeaker?: Player;
  startingSpeaker?: Player;
  players: Player[];
  alivePlayers: Player[];
  onNextSpeaker: () => void;
  onStartVote: () => void;
}

export const PlayView: React.FC<PlayViewProps> = ({
  round,
  totalPlayers,
  speechTime,
  currentSpeaker,
  startingSpeaker,
  players,
  alivePlayers,
  onNextSpeaker,
  onStartVote
}) => {
  const [remainingTime, setRemainingTime] = useState<number>(speechTime);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 當發言者切換時重置計時器
  useEffect(() => {
    if (speechTime > 0) {
      setRemainingTime(speechTime);
    }
  }, [currentSpeaker?.id, speechTime]);

  // 倒數計時邏輯
  useEffect(() => {
    if (speechTime <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          soundManager.playTimerEnd();
          return 0;
        }
        if (prev <= 6 && prev > 1) {
          soundManager.playHeartbeat();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentSpeaker?.id, speechTime]);

  const circumference = 2 * Math.PI * 50;
  const progressFraction = speechTime > 0 ? remainingTime / speechTime : 0;
  const strokeDashoffset = circumference * (1 - progressFraction);

  const handleNext = () => {
    soundManager.playClick();
    onNextSpeaker();
  };

  const handleVote = () => {
    soundManager.playClick();
    if (timerRef.current) clearInterval(timerRef.current);
    onStartVote();
  };

  return (
    <div className="view-container view-enter">
      {/* 頂部局勢狀態 */}
      <div className="flex-between mb-md">
        <div>
          <span className="badge badge-classified">第 {round} 輪情報交換</span>
        </div>
        <span className="badge badge-cyan" style={{ fontSize: '0.85rem' }}>
          存活特工: {alivePlayers.length} / {totalPlayers}
        </span>
      </div>

      {/* 當前發言特工聚光燈卡片 */}
      <div className="card card-glass mb-md text-center" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', padding: '18px 16px' }}>
        <div className="badge badge-cyan mb-sm">當前發言特工 (CURRENT SPEAKER)</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '8px 0 14px' }}>
          <div style={{ fontSize: '2.5rem', background: 'var(--bg-elevated)', width: '64px', height: '64px', borderRadius: 'var(--radius-inner)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--accent-cyan-light)' }}>
            {currentSpeaker ? currentSpeaker.icon : '🕵️'}
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.6rem', color: '#ffffff', fontWeight: 800, margin: 0 }}>
              {currentSpeaker ? currentSpeaker.name : '未知特工'}
            </h2>
            <div className="text-code text-cyan" style={{ fontSize: '0.82rem' }}>
              {currentSpeaker ? currentSpeaker.code : ''}
            </div>
          </div>
        </div>

        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', lineHeight: 1.45, background: 'rgba(8, 12, 22, 0.6)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          💬 請用一句話描述你的詞彙（不可包含詞中任何字）。
        </p>

        {/* 雷達計時器 */}
        {speechTime > 0 ? (
          <div className="radar-timer-wrap" style={{ marginTop: '16px' }}>
            <svg className="radar-timer-svg" viewBox="0 0 120 120">
              <circle className="timer-circle-bg" cx="60" cy="60" r="50" />
              <circle
                className={`timer-circle-progress ${remainingTime <= 10 ? 'warning' : ''}`}
                cx="60"
                cy="60"
                r="50"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="timer-text-content">
              <div className="timer-seconds">{remainingTime}</div>
              <div className="timer-label">{remainingTime === 0 ? '時間到' : 'SEC'}</div>
            </div>
          </div>
        ) : (
          <div className="text-muted text-center" style={{ marginTop: '14px', fontSize: '0.85rem' }}>
            ⏳ 本局無發言時間限制，請自由交流
          </div>
        )}
      </div>

      {/* 發言控制主要按鈕組 */}
      <div className="flex-col gap-sm mb-md">
        <button onClick={handleNext} className="btn btn-primary btn-large btn-full">
          ⏩ 換下一位特工發言
        </button>
        <button onClick={handleVote} className="btn btn-danger btn-full">
          🗳️ 全員發言完畢，發起投票放逐
        </button>
      </div>

      {/* 特工席位狀態名冊 */}
      <div className="card" style={{ padding: '12px 14px', flex: 1 }}>
        <div className="flex-between mb-sm">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--fg-secondary)' }}>特工席位狀態</span>
          <span className="text-code text-muted" style={{ fontSize: '0.75rem' }}>
            起手: {startingSpeaker?.name || ''}
          </span>
        </div>
        <div className="agents-grid" style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {players.map(p => (
            <div
              key={p.id}
              className={`agent-card ${p.id === currentSpeaker?.id ? 'speaking pulse-speaking' : ''} ${!p.isAlive ? 'eliminated' : ''}`}
            >
              <div className="agent-avatar">{p.icon}</div>
              <div className="agent-info">
                <div className="agent-code">{p.code}</div>
                <div className="agent-name">{p.name}</div>
              </div>
              {!p.isAlive && <div className="stamp-overlay">淘汰</div>}
              {p.id === currentSpeaker?.id && (
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan-light)', fontWeight: 'bold' }}>發言中</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
