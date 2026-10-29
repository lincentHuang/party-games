'use client';

import React from 'react';
import { WaitingText } from '@/components/avalon/online/AvalonParts';
import { RT_MIN_PLAYERS } from '@/lib/roundtableEngine';
import { RoundtableAction, RoundtableRoomView, RtEvent } from '@/types/roundtableRoom';
import { RT_ROLE_INFO, rtEventText } from './roundtableShared';

interface ResultProps {
  view: RoundtableRoomView;
  header: React.ReactNode;
  footer: React.ReactNode;
  isBusy: boolean;
  press: (a: RoundtableAction) => void;
  nameOf: (id: string | null | undefined) => string;
}

// 終局：公開所有身分、任務紀錄、每晚事件紀錄、最佳偵探
export const RoundtableResult: React.FC<ResultProps> = ({ view, header, footer, isBusy, press, nameOf }) => {
  const mySeat = view.mySeat;
  const meId = view.me.id;
  const result = view.result;
  const roleOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.role;
  const winnerText = view.winner === 'GOOD' ? '⚔️ 圓桌騎士獲勝' : '🐺 狼人獲勝';
  const iWon = !!mySeat && mySeat.team === view.winner;

  // 事件依輪次分組
  const rounds = new Map<number, RtEvent[]>();
  for (const e of result?.events ?? []) {
    if (!rounds.has(e.round)) rounds.set(e.round, []);
    rounds.get(e.round)!.push(e);
  }

  return (
    <div className="view-container view-enter">
      {header}
      <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '24px 16px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>{winnerText}</h1>
        <p style={{ color: 'var(--fg-secondary)', margin: '6px 0 12px' }}>{view.winReason}</p>
        {mySeat && <div style={{ fontWeight: 800, color: iWon ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>{iWon ? '🎉 你贏了！' : '😵 你輸了'}</div>}
        {result?.huntTargetId && (
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', margin: '10px 0 0' }}>
            🌑 最後獵殺：狼人指認 {nameOf(result.huntTargetId)}，他{result.huntCorrect ? '就是' : '不是'}預言家
          </p>
        )}
      </div>

      <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>所有人的角色</div>
        {view.seats.map(s => {
          const info = s.role ? RT_ROLE_INFO[s.role] : null;
          return (
            <div key={s.playerId} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', gap: '8px' }}>
              <span style={{ color: s.alive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
                {s.name}{s.playerId === meId ? '（你）' : ''}{s.alive ? '' : s.left ? ' 🚪' : ' 💀'}
                {result?.huntTargetId === s.playerId && ' 🎯'}
              </span>
              {info && <span className={`badge ${info.team === 'GOOD' ? 'badge-cyan' : 'badge-role-spy'}`}>{info.emoji} {info.name}</span>}
            </div>
          );
        })}
        {result && result.bestDetectives.length > 0 && (
          <div style={{ fontSize: '0.85rem', color: 'var(--accent-yellow)', paddingTop: '10px' }}>
            🕵️ 最佳偵探：{result.bestDetectives.map(d => `${nameOf(d.playerId)}（猜中 ${d.hits}/${d.total}）`).join('、')}
          </div>
        )}
      </div>

      <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>任務紀錄</div>
        {view.quests.filter(q => q.status !== 'PENDING').map(q => (
          <div key={q.round} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex-between">
              <span style={{ color: '#ffffff', fontWeight: 700 }}>第 {q.round} 輪 {q.status === 'SUCCESS' ? '✅ 成功' : '❌ 失敗'}</span>
              <span className="text-code" style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>成功 {q.successCount} / 失敗 {q.failCount}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{q.team.map(nameOf).join('、')}</div>
          </div>
        ))}
      </div>

      {rounds.size > 0 && (
        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>夜晚事件紀錄</div>
          {[...rounds.entries()].map(([round, list]) => (
            <div key={round} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: '2px' }}>第 {round} 輪之夜</div>
              {list.map((e, i) => (
                <div key={i} style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', padding: '1px 0' }}>{rtEventText(e, nameOf, roleOf)}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex-col gap-sm">
        {view.me.isHost ? (
          <>
            <button onClick={() => press({ action: 'START' })} disabled={isBusy || view.players.length < RT_MIN_PLAYERS} className="btn btn-primary btn-large btn-full">
              🔁 同一批人再來一局
            </button>
            <button onClick={() => press({ action: 'BACK_TO_LOBBY' })} className="btn btn-secondary btn-full">回房間改設定</button>
          </>
        ) : (
          <WaitingText>⏳ 等待房主開下一局…</WaitingText>
        )}
        {footer}
      </div>
    </div>
  );
};
