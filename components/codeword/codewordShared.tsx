'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { CardColor, ClueNumber, CodewordTeam } from '@/types/codewordRoom';

export const TEAM_INFO: Record<CodewordTeam, { name: string; emoji: string; color: string; soft: string }> = {
  RED: { name: '紅隊', emoji: '🔴', color: '#f43f5e', soft: 'rgba(244, 63, 94, 0.18)' },
  BLUE: { name: '藍隊', emoji: '🔵', color: '#3b82f6', soft: 'rgba(59, 130, 246, 0.18)' }
};

export const CARD_STYLE: Record<CardColor, { bg: string; border: string; text: string; label: string }> = {
  RED: { bg: '#be123c', border: '#f43f5e', text: '#ffffff', label: '紅隊' },
  BLUE: { bg: '#1d4ed8', border: '#60a5fa', text: '#ffffff', label: '藍隊' },
  NEUTRAL: { bg: '#78716c', border: '#a8a29e', text: '#ffffff', label: '平民' },
  ASSASSIN: { bg: '#000000', border: '#e2e8f0', text: '#ffffff', label: '刺客' }
};

export const formatClueNumber = (n: ClueNumber) => (n === 'INF' ? '∞' : String(n));

export const TeamBadge: React.FC<{ team: CodewordTeam; suffix?: string }> = ({ team, suffix }) => (
  <span
    className="badge"
    style={{ background: TEAM_INFO[team].soft, color: TEAM_INFO[team].color, border: `1px solid ${TEAM_INFO[team].color}`, fontWeight: 800 }}
  >
    {TEAM_INFO[team].emoji} {TEAM_INFO[team].name}{suffix ?? ''}
  </span>
);

// 隊長出題倒數（只做顯示提醒，不會強制換人）
export const ClueTimer: React.FC<{ startedAt: number; seconds: number; serverNow: () => number; isMine: boolean }> = ({ startedAt, seconds, serverNow, isMine }) => {
  const [now, setNow] = useState(serverNow());
  const alertedRef = useRef(false);

  useEffect(() => {
    alertedRef.current = false;
    const t = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(t);
  }, [startedAt, serverNow]);

  const remaining = Math.max(0, Math.ceil(seconds - (now - startedAt) / 1000));
  useEffect(() => {
    if (remaining === 0 && isMine && !alertedRef.current) {
      alertedRef.current = true;
      soundManager.playTimerEnd();
    }
  }, [remaining, isMine]);

  return (
    <span style={{ fontFamily: 'var(--font-code)', fontWeight: 900, color: remaining <= 10 ? 'var(--accent-magenta)' : 'var(--accent-cyan-light)' }}>
      {remaining === 0 ? '時間到（仍可出題）' : `⏱ ${remaining}s`}
    </span>
  );
};
