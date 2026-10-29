'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { NONE, WerewolfEvent, WerewolfRole, WerewolfSeatView } from '@/types/werewolfRoom';

export const ROLE_INFO: Record<WerewolfRole, { emoji: string; name: string; badge: string; desc: string }> = {
  WOLF: { emoji: '🐺', name: '狼人', badge: 'badge badge-role-spy', desc: '每晚和隊友一起選一人刀掉。白天裝成好人，別被放逐。' },
  VILLAGER: { emoji: '👤', name: '平民', badge: 'badge badge-role-civ', desc: '沒有技能。靠發言與投票找出狼人，夜晚做「夜間推理」。' },
  SEER: { emoji: '🔮', name: '預言家', badge: 'badge badge-cyan', desc: '每晚查驗一人是「好人」還是「狼人」。' },
  WITCH: { emoji: '🧪', name: '女巫', badge: 'badge badge-cyan', desc: '一瓶解藥、一瓶毒藥各用一次，一晚只能用一瓶，不能自救。' },
  HUNTER: { emoji: '🏹', name: '獵人', badge: 'badge badge-cyan', desc: '出局時（被毒除外）可以開槍帶走一人。' },
  GUARD: { emoji: '🛡️', name: '守衛', badge: 'badge badge-cyan', desc: '每晚守護一人，不能連兩晚守同一人。同守同救反而會死。' }
};

export const RoleBadge: React.FC<{ role: WerewolfRole; big?: boolean }> = ({ role, big }) => (
  <span className={ROLE_INFO[role].badge} style={big ? { fontSize: '0.95rem', padding: '6px 14px' } : undefined}>
    {ROLE_INFO[role].emoji} {ROLE_INFO[role].name}
  </span>
);

// 按住才顯示自己的身分，放開立刻遮住（silent：夜晚不出聲，避免旁人聽出動靜）
export const HoldToPeekRole: React.FC<{
  role: WerewolfRole;
  extra?: React.ReactNode;
  compact?: boolean;
  silent?: boolean;
  onFirstReveal?: () => void;
}> = ({ role, extra, compact, silent, onFirstReveal }) => {
  const [holding, setHolding] = useState(false);
  const revealedRef = useRef(false);

  useEffect(() => {
    const release = () => setHolding(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);

  const handleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setHolding(true);
    if (!silent) soundManager.playFingerprintScan();
    if (!revealedRef.current) {
      revealedRef.current = true;
      if (!silent) soundManager.playRevealSecret();
      onFirstReveal?.();
    }
  };

  if (compact) {
    return (
      <button
        onPointerDown={handleDown}
        onContextMenu={e => e.preventDefault()}
        className="btn btn-secondary"
        style={{ fontSize: '0.82rem', padding: '6px 12px', userSelect: 'none', touchAction: 'none', minWidth: '130px' }}
      >
        {holding ? <strong className="text-cyan">{ROLE_INFO[role].emoji} {ROLE_INFO[role].name}</strong> : '🔒 按住看我的身分'}
      </button>
    );
  }

  return (
    <div style={{ userSelect: 'none' }} onContextMenu={e => e.preventDefault()}>
      {holding ? (
        <div className="secret-result-box">
          <div className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan-light)' }}>YOUR ROLE</div>
          <div style={{ fontSize: '3rem' }}>{ROLE_INFO[role].emoji}</div>
          <div className="secret-word-display">{ROLE_INFO[role].name}</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', margin: '4px 0' }}>{ROLE_INFO[role].desc}</p>
          {extra}
        </div>
      ) : (
        <>
          <div className="fingerprint-zone" onPointerDown={handleDown} style={{ touchAction: 'none' }}>
            <span style={{ fontSize: '3rem' }}>👆</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>按住看身分，放開就會遮住，別讓旁邊的人看到</p>
        </>
      )}
    </div>
  );
};

// 發言倒數（只做顯示，不會自動換人）
export const SpeakTimer: React.FC<{ startedAt: number; seconds: number; serverNow: () => number; isMine: boolean }> = ({ startedAt, seconds, serverNow, isMine }) => {
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
    <div style={{ fontFamily: 'var(--font-code)', fontSize: '2.4rem', fontWeight: 900, color: remaining <= 5 ? 'var(--accent-magenta)' : 'var(--accent-cyan-light)' }}>
      {remaining === 0 ? '時間到' : `${remaining}s`}
    </div>
  );
};

export const DeadNotice: React.FC<{ text?: string }> = ({ text }) => (
  <div className="card text-center shrink-0 mb-md" style={{ padding: '14px', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
    <span style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>{text || '💀 你已出局，請保持安靜，別透露任何資訊'}</span>
  </div>
);

interface PickListProps {
  seats: WerewolfSeatView[];
  selectedId?: string | null;
  disabledIds?: string[];
  onPick: (id: string) => void;
  disabled?: boolean;
  // 每位玩家右側的說明文字
  hint?: (seat: WerewolfSeatView, selected: boolean) => React.ReactNode;
  accent?: string;
}

// 行動用的大按鈕清單：選一個人
export const PickList: React.FC<PickListProps> = ({ seats, selectedId, disabledIds = [], onPick, disabled, hint, accent = 'var(--accent-magenta)' }) => (
  <div className="flex-col gap-sm shrink-0 mb-md">
    {seats.map(s => {
      const selected = selectedId === s.playerId;
      const blocked = disabled || disabledIds.includes(s.playerId);
      return (
        <button
          key={s.playerId}
          onClick={() => onPick(s.playerId)}
          disabled={blocked}
          className="card flex-between"
          style={{
            padding: '14px 16px',
            cursor: blocked ? 'not-allowed' : 'pointer',
            opacity: blocked && !selected ? 0.5 : 1,
            borderColor: selected ? accent : undefined,
            boxShadow: selected ? `0 0 16px ${accent}` : undefined
          }}
        >
          <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>{s.name}</span>
          <span style={{ fontSize: '0.85rem', color: selected ? accent : 'var(--fg-muted)' }}>{hint ? hint(s, selected) : selected ? '✔ 已選' : ''}</span>
        </button>
      );
    })}
  </div>
);

export const NoneButton: React.FC<{ label: string; selected?: boolean; onClick: () => void; disabled?: boolean }> = ({ label, selected, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="btn btn-secondary btn-full shrink-0 mb-md"
    style={selected ? { borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' } : undefined}
  >
    {selected ? '✔ ' : ''}{label}
  </button>
);

const CAUSE_TEXT: Record<string, string> = {
  WOLF: '被狼人刀死',
  POISON: '被毒死',
  EXILE: '被放逐',
  HUNTER: '被獵人帶走',
  LEAVE: '離開了遊戲'
};

// 終局的事件紀錄文字
export function eventText(e: WerewolfEvent, nameOf: (id: string | null | undefined) => string): string {
  switch (e.type) {
    case 'WOLF_KILL': return e.targetId ? `🐺 狼人選擇刀 ${nameOf(e.targetId)}` : '🐺 狼人空刀';
    case 'GUARD': return e.targetId ? `🛡️ 守衛 ${nameOf(e.actorId)} 守護 ${nameOf(e.targetId)}` : `🛡️ 守衛 ${nameOf(e.actorId)} 空守`;
    case 'SAVE': return `🧪 女巫 ${nameOf(e.actorId)} 用解藥救了 ${nameOf(e.targetId)}`;
    case 'POISON': return `☠️ 女巫 ${nameOf(e.actorId)} 毒了 ${nameOf(e.targetId)}`;
    case 'SEER': return `🔮 預言家 ${nameOf(e.actorId)} 查驗 ${nameOf(e.targetId)}：${e.isWolf ? '狼人' : '好人'}`;
    case 'DEATH': return `💀 ${nameOf(e.targetId)} ${CAUSE_TEXT[e.cause || 'WOLF']}`;
    case 'EXILE': return e.targetId ? `🗳️ 放逐 ${nameOf(e.targetId)}` : '🗳️ 無人被放逐';
    case 'HUNTER': return e.targetId ? `🏹 獵人 ${nameOf(e.actorId)} 開槍帶走 ${nameOf(e.targetId)}` : `🏹 獵人 ${nameOf(e.actorId)} 放棄開槍`;
    case 'LEAVE': return `🚪 ${nameOf(e.targetId)} 離開了遊戲`;
  }
}

export { NONE };
