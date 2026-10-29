'use client';

import React, { useState } from 'react';
import { DeadNotice, NoneButton } from '@/components/werewolf/werewolfShared';
import { RT_NONE, RoundtableAction, RoundtableRoomView } from '@/types/roundtableRoom';
import { PickList } from './roundtableShared';

interface NightProps {
  view: RoundtableRoomView;
  isBusy: boolean;
  // 夜晚的操作不播任何音效／震動，避免旁人看出誰有行動
  onAct: (action: RoundtableAction) => Promise<boolean>;
  header: React.ReactNode;
  hostBar: React.ReactNode;
  footer: React.ReactNode;
}

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>{children}</p>
);

export const RoundtableNight: React.FC<NightProps> = ({ view, isBusy, onAct, header, hostBar, footer }) => {
  const night = view.night!;
  const me = view.me.id;
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name || '—';
  const aliveSeats = view.seats.filter(s => s.alive);
  const others = aliveSeats.filter(s => s.playerId !== me);
  const act = (a: RoundtableAction) => { onAct(a); };
  const isEvil = view.mySeat?.team === 'EVIL';
  const round = view.questIndex + 1;

  const title = (
    <div className="text-center shrink-0 mb-md">
      <div style={{ fontSize: '2.2rem' }}>🌙</div>
      <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>第 {round} 夜・天黑請閉眼</h2>
      <div
        style={{
          margin: '8px auto 0',
          padding: '8px 12px',
          borderRadius: 'var(--radius-inner)',
          background: night.kill ? 'rgba(244, 63, 94, 0.14)' : 'rgba(96, 165, 250, 0.12)',
          color: night.kill ? '#fda4af' : '#93c5fd',
          fontSize: '0.88rem',
          fontWeight: 700
        }}
      >
        {night.kill ? '🗡️ 騎士凱旋，狼人今夜展開報復' : '🛡️ 狼人今夜按兵不動'}
      </div>
      <div className="text-code" style={{ marginTop: '8px', color: 'var(--accent-cyan-light)', fontWeight: 800 }}>
        已完成 {night.progress.done} / {night.progress.total}
      </div>
    </div>
  );

  let body: React.ReactNode = null;

  switch (night.task) {
    case 'DEAD':
      body = <DeadNotice text="💀 你已陣亡，請保持安靜，夜晚進行中" />;
      break;

    case 'GUARD': {
      const last = view.mySeat?.lastGuardTarget ?? null;
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <strong style={{ color: '#ffffff' }}>🛡️ 守衛，請選擇今晚守護的人</strong>
            <Hint>被守護的人今晚不會被狼人殺死（可以守自己）。不能連兩晚守同一個人。</Hint>
            {last && <Hint>上一晚你守護的是：{nameOf(last)}</Hint>}
          </div>
          <PickList
            seats={aliveSeats}
            selectedId={night.guardTarget}
            disabledIds={last ? [last] : []}
            disabled={isBusy}
            onPick={id => act({ action: 'GUARD', targetId: id })}
            accent="var(--accent-cyan)"
            hint={(s, sel) => (sel ? '✔ 守護中' : s.playerId === last ? '昨晚守過' : s.playerId === me ? '自己' : '')}
          />
          {night.myDone && <Hint>✅ 已完成，等待其他人。要改的話可以重選。</Hint>}
        </>
      );
      break;
    }

    case 'WOLF': {
      const w = night.wolf!;
      const mates = view.mySeat?.mates || [];
      const myPick = w.picks[me];
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
            <strong style={{ color: '#ffffff' }}>🐺 狼人，請和隊友選出今晚的刀口</strong>
            <Hint>
              {mates.length > 0
                ? `隊友：${mates.map(m => `${nameOf(m.playerId)}${m.role === 'HIDDEN_WOLF' ? '（隱狼）' : ''}${view.seats.find(s => s.playerId === m.playerId)?.alive ? '' : '（已陣亡）'}`).join('、')}。`
                : '你是唯一的狼人。'}
              所有存活狼人選同一個人才會鎖定，也可以一起空刀。被守衛守護的人殺不死。
            </Hint>
          </div>
          <PickList
            seats={aliveSeats}
            selectedId={myPick && myPick !== RT_NONE ? myPick : undefined}
            disabled={isBusy}
            onPick={id => act({ action: 'WOLF_PICK', targetId: id })}
            hint={s => {
              const pickers = Object.entries(w.picks).filter(([, t]) => t === s.playerId).map(([id]) => (id === me ? '你' : nameOf(id)));
              return pickers.length > 0 ? `🐺 ${pickers.join('、')}` : '';
            }}
          />
          <NoneButton label="空刀（不殺人）" selected={myPick === RT_NONE} disabled={isBusy} onClick={() => act({ action: 'WOLF_PICK', targetId: RT_NONE })} />
          {Object.entries(w.picks).some(([id, t]) => id !== me && t === RT_NONE) && <Hint>有隊友選了空刀</Hint>}
          <Hint>{w.locked ? '✅ 刀口已鎖定，等待其他人。隊友改選的話會重新鎖定。' : '⏳ 還沒有一致的選擇…'}</Hint>
        </>
      );
      break;
    }

    case 'SEER': {
      const checks = view.mySeat?.seerChecks || [];
      const today = checks.find(c => c.round === round);
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <strong style={{ color: '#ffffff' }}>🔮 預言家，請選擇今晚查驗的人</strong>
            {view.config.hiddenWolf && <Hint>⚠️ 本局有隱狼，查驗顯示「好人」不一定可靠。</Hint>}
          </div>
          {today ? (
            <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '20px 16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>{nameOf(today.targetId)} 是</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: today.showsEvil ? 'var(--accent-magenta)' : 'var(--accent-emerald)', margin: '4px 0' }}>
                {today.showsEvil ? '🐺 狼人' : '👍 好人'}
              </div>
              <Hint>✅ 已完成，等待其他人。</Hint>
            </div>
          ) : (
            <PickList seats={others} disabled={isBusy} onPick={id => act({ action: 'SEER_CHECK', targetId: id })} accent="var(--accent-cyan)" />
          )}
          {checks.filter(c => c.round !== round).length > 0 && (
            <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>歷次查驗</div>
              {checks.filter(c => c.round !== round).map(c => (
                <div key={c.round} className="flex-between" style={{ padding: '3px 0', color: '#ffffff' }}>
                  <span>第 {c.round} 夜・{nameOf(c.targetId)}</span>
                  <span style={{ color: c.showsEvil ? 'var(--accent-magenta)' : 'var(--accent-emerald)' }}>{c.showsEvil ? '狼人' : '好人'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );
      break;
    }

    case 'REFLECT':
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <strong style={{ color: '#ffffff' }}>🕵️ 夜間推理</strong>
            <Hint>
              {isEvil
                ? '今晚狼人不殺人。選一位你覺得是預言家的人，只是記錄，不會影響遊戲。'
                : '選一位你目前最懷疑是狼人的人。只是記錄，不會影響遊戲；終局會頒發「最佳偵探」給懷疑最準的好人。'}
            </Hint>
          </div>
          <PickList
            seats={others}
            selectedId={night.reflectTarget}
            disabled={isBusy}
            onPick={id => act({ action: 'REFLECT', targetId: id })}
            accent="var(--accent-yellow)"
            hint={(_, sel) => (sel ? (isEvil ? '🔎 猜是預言家' : '🔎 懷疑中') : '')}
          />
          {night.myDone && <Hint>✅ 已完成，等待其他人。要改的話可以重選。</Hint>}
        </>
      );
      break;
  }

  return (
    <div className="view-container view-enter">
      {header}
      {title}
      {body}
      <div className="mt-auto flex-col gap-sm">
        {hostBar}
        {footer}
      </div>
    </div>
  );
};

interface FinalHuntProps {
  view: RoundtableRoomView;
  isBusy: boolean;
  onAct: (action: RoundtableAction) => Promise<boolean>;
  header: React.ReactNode;
  hostBar: React.ReactNode;
  footer: React.ReactNode;
}

// 最後獵殺：好人三勝，存活的狼人要一致猜出預言家
export const RoundtableFinalHunt: React.FC<FinalHuntProps> = ({ view, isBusy, onAct, header, hostBar, footer }) => {
  const hunt = view.hunt!;
  const me = view.me.id;
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name || '—';
  const candidates = view.seats.filter(s => hunt.candidates.includes(s.playerId));
  const [selected, setSelected] = useState<string | null>(null);
  const myPick = hunt.picks[me] ?? null;
  const mates = view.mySeat?.mates || [];

  return (
    <div className="view-container view-enter">
      {header}
      <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '2.2rem' }}>🌑</div>
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900, margin: '6px 0' }}>好人完成了三次任務！</h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>
          {hunt.canPick
            ? '最後的機會：和狼隊友小聲討論，一起指認誰是預言家。全員選同一人才會鎖定；猜中，狼人逆轉獲勝。'
            : hunt.isWolfSide
              ? '你已陣亡，但仍能看到隊友的討論。存活的狼人正在選擇預言家。'
              : '狼人正在討論誰是預言家。預言家請保持冷靜，別露出破綻。'}
        </p>
      </div>

      {hunt.isWolfSide && (
        <div className="card shrink-0 mb-md avalon-evil" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>🐺 狼人陣營</div>
          {mates.map(m => {
            const alive = view.seats.find(s => s.playerId === m.playerId)?.alive;
            const pick = hunt.picks[m.playerId];
            return (
              <div key={m.playerId} className="flex-between" style={{ padding: '3px 0' }}>
                <span style={{ color: alive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 800 }}>
                  {nameOf(m.playerId)}{m.role === 'HIDDEN_WOLF' ? '（隱狼）' : ''}{alive ? '' : ' 💀'}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>{pick ? `選了 ${nameOf(pick)}` : alive ? '還沒選' : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      {hunt.canPick ? (
        <>
          <PickList
            seats={candidates}
            selectedId={selected ?? myPick}
            disabled={isBusy}
            onPick={id => setSelected(id)}
            hint={(s, sel) => {
              const pickers = Object.entries(hunt.picks).filter(([, t]) => t === s.playerId).map(([id]) => (id === me ? '你' : nameOf(id)));
              return pickers.length > 0 ? `🎯 ${pickers.join('、')}` : sel ? '待送出' : '';
            }}
          />
          <button
            onClick={() => selected && onAct({ action: 'HUNT_PICK', targetId: selected })}
            disabled={isBusy || !selected || selected === myPick}
            className="btn btn-danger btn-large btn-full shrink-0 mb-md"
          >
            {myPick && !selected ? `✅ 已送出：${nameOf(myPick)}（等隊友一致）` : selected === myPick && myPick ? '✅ 已送出' : '🎯 送出我的選擇'}
          </button>
          <p className="text-center" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
            送出後仍可改選；所有存活狼人送出同一人，就會立刻揭曉結果。
          </p>
        </>
      ) : (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '16px' }}>
          <span style={{ color: 'var(--fg-secondary)' }}>⏳ 等待狼人做出選擇…</span>
        </div>
      )}

      <div className="mt-auto flex-col gap-sm">
        {hostBar}
        {footer}
      </div>
    </div>
  );
};
