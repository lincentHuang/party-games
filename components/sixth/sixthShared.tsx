'use client';

import React, { useEffect, useState } from 'react';
import { bombsOf, rowBombs, SIXTH_ROW_LIMIT, SixthPlacement, SixthRoomView } from '@/types/sixthRoom';

// ───────── 牌面 ─────────

// 依炸彈數給不同底色，一眼看出哪些牌危險
const BOMB_TINT: Record<number, { bg: string; border: string }> = {
  1: { bg: 'var(--bg-elevated)', border: 'var(--border-card)' },
  2: { bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.6)' },
  3: { bg: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 0.75)' },
  5: { bg: 'rgba(244, 63, 94, 0.2)', border: 'rgba(244, 63, 94, 0.8)' },
  7: { bg: 'rgba(139, 92, 246, 0.32)', border: 'rgba(167, 139, 250, 0.95)' }
};

export const BombMark: React.FC<{ n: number; size?: string }> = ({ n, size = '0.7rem' }) => (
  <span style={{ fontSize: size, lineHeight: 1, letterSpacing: '-1px', whiteSpace: 'nowrap' }}>
    {n <= 3 ? '💣'.repeat(n) : `💣×${n}`}
  </span>
);

interface SixthCardProps {
  card: number;
  size?: 'board' | 'hand';
  selected?: boolean; // 手牌：準備要出的牌
  picked?: boolean; // 手牌：已送出的牌
  glow?: 'new' | 'taken' | null; // 桌面：剛放下的牌／被吃掉的牌
  onClick?: () => void;
  disabled?: boolean;
}

export const SixthCard: React.FC<SixthCardProps> = ({ card, size = 'board', selected, picked, glow, onClick, disabled }) => {
  const bombs = bombsOf(card);
  const tint = BOMB_TINT[bombs] ?? BOMB_TINT[1];
  const border = picked ? 'var(--accent-emerald)' : selected ? 'var(--accent-cyan-light)' : glow === 'new' ? 'var(--accent-cyan-light)' : glow === 'taken' ? 'var(--accent-magenta)' : tint.border;
  const style: React.CSSProperties = {
    width: '100%',
    // 桌面牌做成橫的，4 列才塞得進一個手機畫面，手牌不用捲動就看得到
    aspectRatio: size === 'hand' ? '3 / 4' : '5 / 4',
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: size === 'hand' ? '3px' : '0',
    padding: '2px',
    borderRadius: '10px',
    background: tint.bg,
    border: `2px solid ${border}`,
    color: '#ffffff',
    fontFamily: 'var(--font-code)',
    fontWeight: 900,
    fontSize: size === 'hand' ? 'clamp(1.2rem, 6vw, 1.6rem)' : 'clamp(1.15rem, 5.6vw, 1.5rem)',
    boxShadow: glow === 'new' ? '0 0 14px rgba(34, 211, 238, 0.7)' : glow === 'taken' ? '0 0 14px rgba(244, 63, 94, 0.7)' : selected ? '0 0 12px rgba(34, 211, 238, 0.5)' : 'none',
    transform: selected ? 'translateY(-8px) scale(1.04)' : glow === 'new' ? 'scale(1.08)' : 'none',
    transition: 'transform 0.18s ease, box-shadow 0.25s ease, border-color 0.25s ease',
    cursor: onClick && !disabled ? 'pointer' : 'default',
    opacity: disabled ? 0.55 : 1,
    userSelect: 'none'
  };
  const inner = (
    <>
      <span>{card}</span>
      <BombMark n={bombs} />
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>{inner}</button>
  ) : (
    <div style={style}>{inner}</div>
  );
};

// ───────── 桌面 4 列 ─────────

interface BoardProps {
  rows: number[][];
  highlight?: { row: number; card: number; taken: boolean } | null;
  clickable?: boolean;
  selectedRow?: number | null;
  onRowClick?: (row: number) => void;
}

export const SixthBoard: React.FC<BoardProps> = ({ rows, highlight, clickable, selectedRow, onRowClick }) => (
  <div className="flex-col gap-sm shrink-0 mb-md">
    {rows.map((row, ri) => {
      const isSel = selectedRow === ri;
      const isHi = highlight?.row === ri;
      const Wrapper: React.ElementType = clickable ? 'button' : 'div';
      return (
        <Wrapper
          key={ri}
          type={clickable ? 'button' : undefined}
          onClick={clickable ? () => onRowClick?.(ri) : undefined}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'left',
            padding: '4px 8px 6px',
            borderRadius: '12px',
            background: isSel ? 'rgba(244, 63, 94, 0.18)' : 'rgba(255,255,255,0.04)',
            border: `2px ${clickable ? 'solid' : 'dashed'} ${isSel ? 'var(--accent-magenta)' : clickable ? 'rgba(244, 63, 94, 0.5)' : isHi ? 'rgba(34, 211, 238, 0.5)' : 'var(--border-subtle)'}`,
            cursor: clickable ? 'pointer' : 'default',
            color: '#ffffff',
            transition: 'all 0.2s ease'
          }}
        >
          <div className="flex-between" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginBottom: '3px' }}>
            <span>第 {ri + 1} 列{row.length >= SIXTH_ROW_LIMIT ? '（滿了，下一張會爆）' : ''}</span>
            <span>吃下去 <BombMark n={rowBombs(row)} size="0.72rem" /></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIXTH_ROW_LIMIT}, 1fr)`, gap: '5px' }}>
            {Array.from({ length: SIXTH_ROW_LIMIT }, (_, ci) => {
              const c = row[ci];
              if (c === undefined) {
                return <div key={ci} style={{ aspectRatio: '5 / 4', borderRadius: '10px', border: '2px dashed rgba(255,255,255,0.1)' }} />;
              }
              const glow = isHi && highlight?.card === c ? (highlight.taken ? 'taken' : 'new') : null;
              return <SixthCard key={ci} card={c} glow={glow} />;
            })}
          </div>
        </Wrapper>
      );
    })}
  </div>
);

// ───────── 揭曉動畫：依擺放紀錄逐張重播 ─────────

const REPLAY_FIRST_MS = 700;
const REPLAY_STEP_MS = 1300;

function applyEvent(rows: number[][], ev: SixthPlacement): number[][] {
  const next = rows.map(r => [...r]);
  if (ev.kind === 'APPEND') next[ev.row].push(ev.card);
  else next[ev.row] = [ev.card];
  return next;
}

export function useRoundReplay(view: SixthRoomView) {
  const log = view.roundLog;
  const key = log ? `${log.hand}-${log.round}` : '';
  const total = log?.events.length ?? 0;
  // 剛進畫面（或斷線重連）時，之前已經算完的輪次直接顯示結果，不重播
  const [st, setSt] = useState(() => ({ key, shown: total }));
  const cur = st.key === key ? st.shown : 0;
  const animating = cur < total;

  useEffect(() => {
    if (!log || cur >= total) return;
    const t = setTimeout(() => setSt({ key, shown: cur + 1 }), cur === 0 ? REPLAY_FIRST_MS : REPLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [key, cur, total, log]);

  let rows = view.rows;
  let shownEvents: SixthPlacement[] = [];
  if (log) {
    shownEvents = log.events.slice(0, cur);
    if (animating) rows = shownEvents.reduce(applyEvent, log.startRows.map(r => [...r]));
  }
  const last = shownEvents[shownEvents.length - 1] ?? null;
  const highlight = last && (animating || cur === total) ? { row: last.row, card: last.card, taken: false } : null;
  // 吃牌的那一步，高亮新列首張（被吃掉的牌已不在桌上，用紅框標示新首張）
  if (highlight && last && last.kind !== 'APPEND') highlight.taken = true;

  return { rows, animating, shownEvents, shownCount: cur, total, highlight, log };
}

export function placementText(ev: SixthPlacement, nameOf: (id: string) => string): string {
  const who = nameOf(ev.playerId);
  switch (ev.kind) {
    case 'APPEND': return `${who} 打出 ${ev.card}，接在第 ${ev.row + 1} 列`;
    case 'SIXTH': return `${who} 的 ${ev.card} 是第 6 張！吃掉第 ${ev.row + 1} 列（${ev.taken.length} 張，💣×${ev.bombs}）`;
    default: return `${who} 的 ${ev.card} 比所有列都小，選了第 ${ev.row + 1} 列吃掉（💣×${ev.bombs}）`;
  }
}
