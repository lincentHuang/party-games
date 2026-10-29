'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { OneNightEvent, OneNightIntel, OneNightRole } from '@/types/oneNightRoom';

export const ROLE_INFO: Record<OneNightRole, { emoji: string; name: string; badge: string; desc: string; night: string }> = {
  WOLF: { emoji: '🐺', name: '狼人', badge: 'badge badge-role-spy', desc: '狼人陣營。白天裝成好人，別被投出局。', night: '夜裡你會看到其他狼隊友；如果只有你一隻狼，可以偷看一張中央牌。' },
  MINION: { emoji: '🦹', name: '爪牙', badge: 'badge badge-role-spy', desc: '狼人陣營，但狼人不知道你。要保護狼人，別讓他被投出局。', night: '夜裡你會知道誰是狼人。' },
  SEER: { emoji: '🔮', name: '預言家', badge: 'badge badge-cyan', desc: '好人陣營。', night: '看一位玩家的牌，或看兩張中央牌。' },
  ROBBER: { emoji: '🦝', name: '強盜', badge: 'badge badge-cyan', desc: '好人陣營（但你換到什麼，就是什麼陣營）。', night: '和一位玩家交換牌，並看到換來的新牌。' },
  TROUBLEMAKER: { emoji: '🃏', name: '搗蛋鬼', badge: 'badge badge-cyan', desc: '好人陣營。', night: '交換另外兩位玩家的牌（你不會看到牌）。' },
  DRUNK: { emoji: '🍺', name: '酒鬼', badge: 'badge badge-cyan', desc: '好人陣營（但你換到什麼，就是什麼陣營）。', night: '和一張中央牌交換（你不會看到新牌）。' },
  INSOMNIAC: { emoji: '😵', name: '失眠者', badge: 'badge badge-cyan', desc: '好人陣營。', night: '夜晚結算後，看自己最後的牌。' },
  HUNTER: { emoji: '🏹', name: '獵人', badge: 'badge badge-cyan', desc: '好人陣營。你出局時，你投的那個人也會一起出局。', night: '沒有夜間技能，改做「夜間猜測」：你覺得誰是狼。' },
  VILLAGER: { emoji: '👤', name: '村民', badge: 'badge badge-role-civ', desc: '好人陣營，沒有技能。', night: '沒有夜間技能，改做「夜間猜測」：你覺得誰是狼。' }
};

export const RoleBadge: React.FC<{ role: OneNightRole; big?: boolean }> = ({ role, big }) => (
  <span className={ROLE_INFO[role].badge} style={big ? { fontSize: '0.95rem', padding: '6px 14px' } : undefined}>
    {ROLE_INFO[role].emoji} {ROLE_INFO[role].name}
  </span>
);

export const centerName = (i: number) => `中央第 ${i + 1} 張`;

// 按住才顯示內容，放開立刻遮住（silent：不出聲，避免旁人聽出動靜）
export const HoldReveal: React.FC<{
  label: string;
  children: React.ReactNode;
  silent?: boolean;
  onFirstReveal?: () => void;
}> = ({ label, children, silent, onFirstReveal }) => {
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

  return (
    <div style={{ userSelect: 'none' }} onContextMenu={e => e.preventDefault()}>
      {holding ? (
        <div className="secret-result-box">{children}</div>
      ) : (
        <>
          <div className="fingerprint-zone" onPointerDown={handleDown} style={{ touchAction: 'none' }}>
            <span style={{ fontSize: '3rem' }}>👆</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{label}，放開就會遮住，別讓旁邊的人看到</p>
        </>
      )}
    </div>
  );
};

// 角色牌（按住看）內容
export const RoleCardBody: React.FC<{ role: OneNightRole; title?: string; showNight?: boolean }> = ({ role, title = 'YOUR CARD', showNight }) => (
  <>
    <div className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan-light)' }}>{title}</div>
    <div style={{ fontSize: '3rem' }}>{ROLE_INFO[role].emoji}</div>
    <div className="secret-word-display">{ROLE_INFO[role].name}</div>
    <p style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', margin: '4px 0' }}>{ROLE_INFO[role].desc}</p>
    {showNight && <p style={{ fontSize: '0.82rem', color: 'var(--accent-yellow)', margin: '4px 0 0' }}>🌙 夜裡：{ROLE_INFO[role].night}</p>}
  </>
);

// 白天倒數（只做顯示，不會自動開票）
export const DayTimer: React.FC<{ startedAt: number; minutes: number; serverNow: () => number }> = ({ startedAt, minutes, serverNow }) => {
  const [now, setNow] = useState(serverNow());
  const alertedRef = useRef(false);

  useEffect(() => {
    alertedRef.current = false;
    const t = setInterval(() => setNow(serverNow()), 500);
    return () => clearInterval(t);
  }, [startedAt, serverNow]);

  const total = minutes * 60;
  const remaining = Math.max(0, Math.ceil(total - (now - startedAt) / 1000));
  useEffect(() => {
    if (minutes > 0 && remaining === 0 && !alertedRef.current) {
      alertedRef.current = true;
      soundManager.playTimerEnd();
    }
  }, [remaining, minutes]);

  if (minutes === 0) {
    return <div style={{ fontFamily: 'var(--font-code)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-cyan-light)' }}>不限時</div>;
  }
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, '0');
  return (
    <div style={{ fontFamily: 'var(--font-code)', fontSize: '2.6rem', fontWeight: 900, color: remaining <= 30 ? 'var(--accent-magenta)' : 'var(--accent-cyan-light)' }}>
      {remaining === 0 ? '時間到' : `${mm}:${ss}`}
    </div>
  );
};

// 判斷白天倒數是否已到（用在「時間到後任何人都能開投」的按鈕）
export function useDayExpired(startedAt: number, minutes: number, serverNow: () => number): boolean {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, [serverNow]);
  return minutes > 0 && now - startedAt >= minutes * 60 * 1000;
}

interface PickListProps {
  players: { playerId: string; name: string }[];
  selectedIds?: (string | null | undefined)[];
  disabledIds?: string[];
  onPick: (id: string) => void;
  disabled?: boolean;
  hint?: (id: string, selected: boolean) => React.ReactNode;
  accent?: string;
}

// 行動用的大按鈕清單：選一個人
export const PickList: React.FC<PickListProps> = ({ players, selectedIds = [], disabledIds = [], onPick, disabled, hint, accent = 'var(--accent-magenta)' }) => (
  <div className="flex-col gap-sm shrink-0 mb-md">
    {players.map(p => {
      const selected = selectedIds.includes(p.playerId);
      const blocked = disabled || disabledIds.includes(p.playerId);
      return (
        <button
          key={p.playerId}
          onClick={() => onPick(p.playerId)}
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
          <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>{p.name}</span>
          <span style={{ fontSize: '0.85rem', color: selected ? accent : 'var(--fg-muted)' }}>{hint ? hint(p.playerId, selected) : selected ? '✔ 已選' : ''}</span>
        </button>
      );
    })}
  </div>
);

// 選中央牌：三張並排
export const CenterPicker: React.FC<{
  selected: number[];
  onPick: (i: number) => void;
  disabled?: boolean;
  revealed?: Record<number, OneNightRole>;
}> = ({ selected, onPick, disabled, revealed }) => (
  <div style={{ display: 'flex', gap: '8px' }} className="shrink-0 mb-md">
    {[0, 1, 2].map(i => {
      const on = selected.includes(i);
      return (
        <button
          key={i}
          onClick={() => onPick(i)}
          disabled={disabled}
          className="card text-center"
          style={{
            flex: 1,
            padding: '16px 6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            borderColor: on ? 'var(--accent-cyan-light)' : undefined,
            boxShadow: on ? '0 0 16px var(--accent-cyan-light)' : undefined
          }}
        >
          <div style={{ fontSize: '1.8rem' }}>{revealed?.[i] ? ROLE_INFO[revealed[i]].emoji : '🂠'}</div>
          <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.85rem' }}>{revealed?.[i] ? ROLE_INFO[revealed[i]].name : `中央 ${i + 1}`}</div>
        </button>
      );
    })}
  </div>
);

// 夜裡得知的資訊（白話文字）
export function intelText(it: OneNightIntel, nameOf: (id: string | null | undefined) => string): string {
  const r = (role: OneNightRole) => `${ROLE_INFO[role].emoji}${ROLE_INFO[role].name}`;
  switch (it.kind) {
    case 'WOLF_MATES': return it.ids.length > 0 ? `🐺 你的狼隊友：${it.ids.map(nameOf).join('、')}` : '🐺 你是唯一的狼人（玩家之中沒有其他狼）';
    case 'MINION_SEES': return it.ids.length > 0 ? `🦹 狼人是：${it.ids.map(nameOf).join('、')}` : '🦹 玩家之中沒有狼人（狼都在中央）';
    case 'PEEK_CENTER': return it.indices.map((idx, i) => `${centerName(idx)}是 ${r(it.roles[i])}`).join('；');
    case 'SEE_PLAYER': return `🔮 ${nameOf(it.targetId)} 是 ${r(it.role)}`;
    case 'ROBBED': return `🦝 你搶了 ${nameOf(it.targetId)}，你現在是 ${r(it.role)}（對方變成強盜）`;
    case 'SWAPPED': return `🃏 你交換了 ${nameOf(it.aId)} 和 ${nameOf(it.bId)} 的牌`;
    case 'DRUNK': return `🍺 你和${centerName(it.index)}交換了（你不知道換到什麼）`;
    case 'INSOMNIAC': return `😵 你最後的牌是 ${r(it.role)}`;
    case 'GUESS': return `🤔 你覺得 ${nameOf(it.targetId)} 是狼`;
  }
}

export const IntelList: React.FC<{ intel: OneNightIntel[]; nameOf: (id: string | null | undefined) => string }> = ({ intel, nameOf }) => (
  <div style={{ textAlign: 'left' }}>
    <div className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan-light)', marginBottom: '6px' }}>夜裡得知的資訊</div>
    {intel.length === 0 && <div style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>你夜裡沒有得到任何資訊</div>}
    {intel.map((it, i) => (
      <div key={i} style={{ color: '#ffffff', fontSize: '0.92rem', padding: '3px 0' }}>{intelText(it, nameOf)}</div>
    ))}
  </div>
);

// 終局的夜晚紀錄文字
export function eventText(e: OneNightEvent, nameOf: (id: string | null | undefined) => string): string {
  const r = (role: OneNightRole) => `${ROLE_INFO[role].emoji}${ROLE_INFO[role].name}`;
  switch (e.type) {
    case 'WOLF_PEEK': return `🐺 落單的狼人 ${nameOf(e.actorId)} 偷看${centerName(e.index)}：${r(e.role)}`;
    case 'SEER_PLAYER': return `🔮 預言家 ${nameOf(e.actorId)} 查看 ${nameOf(e.targetId)}：${r(e.role)}`;
    case 'SEER_CENTER': return `🔮 預言家 ${nameOf(e.actorId)} 查看${e.indices.map((idx, i) => `${centerName(idx)}（${r(e.roles[i])}）`).join('、')}`;
    case 'ROBBER': return e.targetId ? `🦝 強盜 ${nameOf(e.actorId)} 和 ${nameOf(e.targetId)} 交換了牌` : `🦝 強盜 ${nameOf(e.actorId)} 沒有行動`;
    case 'TROUBLEMAKER': return e.aId && e.bId ? `🃏 搗蛋鬼 ${nameOf(e.actorId)} 交換了 ${nameOf(e.aId)} 和 ${nameOf(e.bId)}` : `🃏 搗蛋鬼 ${nameOf(e.actorId)} 沒有行動`;
    case 'DRUNK': return `🍺 酒鬼 ${nameOf(e.actorId)} 和${centerName(e.index)}交換了`;
  }
}
