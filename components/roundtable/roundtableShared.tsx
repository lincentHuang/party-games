'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { RoundtableRoomView, RtEvent, RtRole, RtTeam } from '@/types/roundtableRoom';

export const RT_ROLE_INFO: Record<RtRole, { emoji: string; name: string; team: RtTeam; desc: string }> = {
  SEER: { emoji: '🔮', name: '預言家', team: 'GOOD', desc: '每晚查驗一位玩家是不是狼人，結果只有你看得到。小心：狼人若在三勝時猜中你，會逆轉獲勝。' },
  GUARD: { emoji: '🛡️', name: '守衛', team: 'GOOD', desc: '每晚守護一人（可以守自己），被守護者當晚不會被狼殺。不能連兩晚守同一人。' },
  HUNTER: { emoji: '🏹', name: '獵人', team: 'GOOD', desc: '夜裡被狼人殺死時，可以開槍帶走一個人。' },
  KNIGHT: { emoji: '⚔️', name: '騎士', team: 'GOOD', desc: '沒有技能。出任務只能出成功，靠表決和夜間推理找出狼人。' },
  WOLF: { emoji: '🐺', name: '狼人', team: 'EVIL', desc: '混在騎士中破壞任務。任務成功的那一晚可以和隊友一起殺人；三勝時猜中預言家就能逆轉。' },
  HIDDEN_WOLF: { emoji: '🌑', name: '隱狼', team: 'EVIL', desc: '壞人陣營。狼隊友認識你，但預言家查驗你只會顯示「好人」。' }
};

export const isEvilRole = (role: RtRole) => role === 'WOLF' || role === 'HIDDEN_WOLF';

type MySeat = NonNullable<RoundtableRoomView['mySeat']>;

// 角色牌：角色、陣營、說明與狼隊友
export const RoleCard: React.FC<{ seat: MySeat; nameOf: (id: string | null) => string }> = ({ seat, nameOf }) => {
  const info = RT_ROLE_INFO[seat.role];
  const good = info.team === 'GOOD';
  return (
    <div className={`card ${good ? 'avalon-good' : 'avalon-evil'}`} style={{ padding: '16px', textAlign: 'center', width: '100%' }}>
      <div style={{ fontSize: '2.6rem' }}>{info.emoji}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff' }}>{info.name}</div>
      <span className={good ? 'badge badge-cyan' : 'badge badge-role-spy'} style={{ margin: '6px 0' }}>
        {good ? '⚔️ 圓桌騎士陣營' : '🐺 狼人陣營'}
      </span>
      <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', margin: '8px 0' }}>{info.desc}</p>
      {seat.mates && (
        <div style={{ textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-inner)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>🐺 你的狼隊友</div>
          {seat.mates.length === 0 && <div style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>沒有其他隊友</div>}
          {seat.mates.map(m => (
            <div key={m.playerId} className="flex-between" style={{ padding: '3px 0' }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>{nameOf(m.playerId)}</span>
              <span style={{ color: m.role === 'HIDDEN_WOLF' ? 'var(--accent-yellow)' : 'var(--fg-secondary)', fontSize: '0.85rem' }}>
                {m.role === 'HIDDEN_WOLF' ? '🌑 隱狼（查驗顯示好人）' : '🐺 狼人'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 按住才顯示自己的身分，放開立刻遮住（silent：夜晚不出聲，避免旁人聽出動靜）
export const HoldToPeekRole: React.FC<{
  seat: MySeat;
  nameOf: (id: string | null) => string;
  compact?: boolean;
  silent?: boolean;
  onFirstReveal?: () => void;
}> = ({ seat, nameOf, compact, silent, onFirstReveal }) => {
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
      <>
        <button
          onPointerDown={handleDown}
          onContextMenu={e => e.preventDefault()}
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '6px 12px', userSelect: 'none', touchAction: 'none', minWidth: '120px' }}
        >
          {holding ? <strong className="text-cyan">{RT_ROLE_INFO[seat.role].name}</strong> : '🔒 按住看我的身分'}
        </button>
        {holding && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
            <div style={{ maxWidth: '420px', width: '100%' }}><RoleCard seat={seat} nameOf={nameOf} /></div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ userSelect: 'none' }} onContextMenu={e => e.preventDefault()}>
      {holding ? (
        <RoleCard seat={seat} nameOf={nameOf} />
      ) : (
        <>
          <div className="fingerprint-zone" onPointerDown={handleDown} style={{ touchAction: 'none' }}>
            <span style={{ fontSize: '3rem' }}>👆</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>按住看你的角色（狼人會看到隊友），放開就會遮住，別讓旁邊的人看到</p>
        </>
      )}
    </div>
  );
};

const phaseLabel = (view: RoundtableRoomView): string => {
  switch (view.phase) {
    case 'REVEAL': return '確認身分中';
    case 'RESULT': return '對局結束';
    case 'NIGHT': return `🌙 夜晚・第 ${view.questIndex + 1} 輪`;
    case 'FINAL_HUNT': return '🌑 最後獵殺';
    case 'DAWN':
    case 'HUNTER': return `🌅 天亮・第 ${view.questIndex + 1} 輪`;
    default: return `☀️ 白天・第 ${view.questIndex + 1} 輪`;
  }
};

// 頂部資訊列：階段（白天/夜晚）、第幾輪、存活人數、任務圓點、否決次數、隊長、按住看身分
export const RtTopBar: React.FC<{
  view: RoundtableRoomView;
  nameOf: (id: string | null) => string;
}> = ({ view, nameOf }) => {
  const present = view.seats.filter(s => !s.left);
  const aliveCount = present.filter(s => s.alive).length;
  const night = view.phase === 'NIGHT' || view.phase === 'FINAL_HUNT';
  const showTrack = view.phase !== 'REVEAL' && view.quests.length > 0;
  const showLeader = !!view.leaderId && !['REVEAL', 'RESULT', 'NIGHT', 'FINAL_HUNT', 'DAWN', 'HUNTER'].includes(view.phase);
  return (
    <>
      <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
        <div className="flex-col">
          <span className="badge badge-classified">{phaseLabel(view)}</span>
          <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>
            {view.roomId}{view.phase !== 'REVEAL' ? ` · 存活 ${aliveCount}/${present.length}` : ''}
          </span>
        </div>
        {view.mySeat && view.phase !== 'REVEAL' && view.phase !== 'RESULT' && (
          <HoldToPeekRole seat={view.mySeat} nameOf={nameOf} compact silent={night || view.phase === 'DAWN'} />
        )}
      </div>
      {showTrack && (
        <div className="shrink-0 mb-md">
          <div className="quest-track">
            {view.quests.map((q, i) => {
              const cls = q.status === 'SUCCESS' ? 'quest-node-success' : q.status === 'FAILED' ? 'quest-node-failed'
                : i === view.questIndex && view.phase !== 'RESULT' ? 'quest-node-current' : '';
              return (
                <div key={q.round} className={`quest-node ${cls}`}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>第 {q.round} 輪</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>
                    {q.status === 'SUCCESS' ? '✅' : q.status === 'FAILED' ? '❌' : q.requiredPlayers}
                  </span>
                  <span style={{ fontSize: '0.64rem', color: q.requiresTwoFails ? 'var(--accent-yellow)' : 'var(--fg-muted)' }}>
                    {q.status === 'PENDING' ? (q.requiresTwoFails ? '需2張失敗' : `${q.requiredPlayers} 人`) : `${q.successCount}成/${q.failCount}敗`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex-between" style={{ marginTop: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: view.rejectCount >= 3 ? 'var(--accent-magenta)' : 'var(--fg-secondary)' }}>
              🚫 否決 {view.rejectCount}/5
            </span>
            {showLeader && (
              <span style={{ color: 'var(--fg-secondary)' }}>
                👑 隊長：<strong style={{ color: '#ffffff' }}>{nameOf(view.leaderId)}{view.leaderId === view.me.id ? '（你）' : ''}</strong>
              </span>
            )}
          </div>
        </div>
      )}
      {view.mySeat && !view.mySeat.alive && view.phase !== 'REVEAL' && view.phase !== 'RESULT' && (
        <div className="shrink-0 mb-md" style={{ padding: '10px 12px', borderRadius: 'var(--radius-inner)', background: 'rgba(244, 63, 94, 0.14)', color: '#fda4af', fontSize: '0.88rem', textAlign: 'center' }}>
          💀 你已陣亡：仍可表決，但請不要發言
        </div>
      )}
    </>
  );
};

interface PickSeat { playerId: string; name: string; alive?: boolean }

interface PickListProps {
  seats: PickSeat[];
  selectedId?: string | null;
  disabledIds?: string[];
  onPick: (id: string) => void;
  disabled?: boolean;
  hint?: (seat: PickSeat, selected: boolean) => React.ReactNode;
  accent?: string;
}

// 大按鈕清單：選一個人
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

export const SecondaryButton: React.FC<{ label: string; selected?: boolean; onClick: () => void; disabled?: boolean }> = ({ label, selected, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="btn btn-secondary btn-full shrink-0 mb-md"
    style={selected ? { borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' } : undefined}
  >
    {selected ? '✔ ' : ''}{label}
  </button>
);

// 終局的事件紀錄文字
export function rtEventText(e: RtEvent, nameOf: (id: string | null | undefined) => string, roleOf: (id: string | null | undefined) => RtRole | undefined): string {
  switch (e.type) {
    case 'KILL': return e.targetId ? `🐺 狼人鎖定刀口：${nameOf(e.targetId)}` : '🐺 狼人空刀（沒有鎖定任何人）';
    case 'NO_KILL': return '🌙 任務失敗，狼人按兵不動';
    case 'GUARD': return `🛡️ 守衛 ${nameOf(e.actorId)} 守護 ${nameOf(e.targetId)}`;
    case 'SEER': return `🔮 預言家 ${nameOf(e.actorId)} 查驗 ${nameOf(e.targetId)}：顯示${e.shownEvil ? '狼人' : '好人'}${roleOf(e.targetId) === 'HIDDEN_WOLF' ? '（其實是隱狼）' : ''}`;
    case 'DEATH': return `💀 ${nameOf(e.targetId)} ${e.cause === 'HUNTER' ? '被獵人帶走' : e.cause === 'LEAVE' ? '離開了遊戲' : '被狼人殺死'}`;
    case 'HUNTER': return e.targetId ? `🏹 獵人 ${nameOf(e.actorId)} 開槍帶走 ${nameOf(e.targetId)}` : `🏹 獵人 ${nameOf(e.actorId)} 放棄開槍`;
    case 'LEAVE': return `🚪 ${nameOf(e.targetId)} 離開了遊戲，視同陣亡`;
  }
}
