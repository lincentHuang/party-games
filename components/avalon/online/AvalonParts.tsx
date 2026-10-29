'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ROLE_INFO } from '@/lib/avalonRules';
import { soundManager } from '@/lib/soundManager';
import { AvalonRoomView } from '@/types/avalonRoom';

type MySeat = NonNullable<AvalonRoomView['mySeat']>;

// 角色牌：角色、陣營、說明與夜間視野
export const RoleCard: React.FC<{ seat: MySeat }> = ({ seat }) => {
  const info = ROLE_INFO[seat.role];
  const good = seat.alignment === 'GOOD';
  return (
    <div className={`card ${good ? 'avalon-good' : 'avalon-evil'}`} style={{ padding: '16px', textAlign: 'center', width: '100%' }}>
      <div style={{ fontSize: '2.6rem' }}>{info.icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff' }}>{info.name}</div>
      <span className={good ? 'badge badge-cyan' : 'badge badge-role-spy'} style={{ margin: '6px 0' }}>
        {good ? '⚔️ 亞瑟的正義陣營' : '🗡️ 莫德雷德的邪惡陣營'}
      </span>
      <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', margin: '8px 0' }}>{info.desc}</p>
      <div style={{ textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-inner)', padding: '10px 12px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>🌙 你在夜晚看到的</div>
        {seat.vision.length > 0 ? (
          seat.vision.map(v => (
            <div key={v.playerId} className="flex-between" style={{ padding: '3px 0' }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>{v.name}</span>
              <span style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>{v.label}</span>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>什麼都沒看到，靠討論和推理吧</div>
        )}
        {seat.role === 'MERLIN' && <div style={{ color: 'var(--accent-yellow)', fontSize: '0.8rem', marginTop: '4px' }}>⚠️ 若有莫德雷德，你看不到他</div>}
      </div>
    </div>
  );
};

// 按住才顯示自己的身分，放開立刻遮住
export const HoldToPeekRole: React.FC<{ seat: MySeat; compact?: boolean; onFirstReveal?: () => void }> = ({ seat, compact, onFirstReveal }) => {
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
    soundManager.playFingerprintScan();
    if (!revealedRef.current) {
      revealedRef.current = true;
      soundManager.playRevealSecret();
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
          {holding ? <strong className="text-cyan">{ROLE_INFO[seat.role].name}</strong> : '🔒 按住看我的身分'}
        </button>
        {holding && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
            <div style={{ maxWidth: '420px', width: '100%' }}><RoleCard seat={seat} /></div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ userSelect: 'none' }} onContextMenu={e => e.preventDefault()}>
      {holding ? (
        <RoleCard seat={seat} />
      ) : (
        <>
          <div className="fingerprint-zone" onPointerDown={handleDown} style={{ touchAction: 'none' }}>
            <span style={{ fontSize: '3rem' }}>👆</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>按住看你的角色與夜間視野，放開就會遮住，別讓旁邊的人看到</p>
        </>
      )}
    </div>
  );
};

// 五輪任務圓點、否決次數、目前隊長
export const QuestTrack: React.FC<{ view: AvalonRoomView; nameOf: (id: string | null) => string }> = ({ view, nameOf }) => {
  if (view.quests.length === 0) return null;
  return (
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
        {view.leaderId && view.phase !== 'RESULT' && view.phase !== 'ASSASSINATE' && (
          <span style={{ color: 'var(--fg-secondary)' }}>
            👑 隊長：<strong style={{ color: '#ffffff' }}>{nameOf(view.leaderId)}{view.leaderId === view.me.id ? '（你）' : ''}</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export const HostBar: React.FC<{ show: boolean; children: React.ReactNode }> = ({ show, children }) => !show ? null : (
  <div className="card shrink-0" style={{ padding: '10px 12px', borderStyle: 'dashed' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>👑 房主控制</div>
    {children}
  </div>
);

export const WaitingText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>{children}</div>
);
