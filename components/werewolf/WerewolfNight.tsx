'use client';

import React, { useState } from 'react';
import { NONE, WerewolfAction, WerewolfRoomView } from '@/types/werewolfRoom';
import { DeadNotice, NoneButton, PickList } from './werewolfShared';

interface WerewolfNightProps {
  view: WerewolfRoomView;
  isBusy: boolean;
  // 夜晚的操作不播任何音效／震動，避免旁人看出誰有行動
  onAct: (action: WerewolfAction) => Promise<boolean>;
  header: React.ReactNode;
  hostBar: React.ReactNode;
  footer: React.ReactNode;
}

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>{children}</p>
);

export const WerewolfNight: React.FC<WerewolfNightProps> = ({ view, isBusy, onAct, header, hostBar, footer }) => {
  const night = view.night!;
  const me = view.me.id;
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name || '—';
  const aliveSeats = view.seats.filter(s => s.isAlive);
  const others = aliveSeats.filter(s => s.playerId !== me);
  const [poisonMode, setPoisonMode] = useState(false);
  const act = (a: WerewolfAction) => { onAct(a); };

  const title = (
    <div className="text-center shrink-0 mb-md">
      <div style={{ fontSize: '2.2rem' }}>🌙</div>
      <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>
        {view.phase === 'NIGHT' ? `第 ${view.round} 夜・天黑請閉眼` : `第 ${view.round} 夜・夜晚進行中`}
      </h2>
      <div className="text-code" style={{ marginTop: '6px', color: 'var(--accent-cyan-light)', fontWeight: 800 }}>
        已完成 {night.progress.done} / {night.progress.total}
      </div>
    </div>
  );

  let body: React.ReactNode = null;

  switch (night.task) {
    case 'DEAD':
      body = <DeadNotice text="💀 你已出局，請保持安靜，夜晚進行中" />;
      break;

    case 'GUARD': {
      const g = night.guard!;
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <strong style={{ color: '#ffffff' }}>🛡️ 守衛，請選擇今晚守護的人</strong>
            <Hint>被狼人刀到的人若只被你守住就能活下來；但如果女巫也救了同一個人，他反而會死。不能連兩晚守同一個人。</Hint>
          </div>
          <PickList
            seats={aliveSeats}
            selectedId={night.myDone ? g.target : undefined}
            disabledIds={g.lastTarget ? [g.lastTarget] : []}
            disabled={isBusy}
            onPick={id => act({ action: 'GUARD', targetId: id })}
            accent="var(--accent-cyan)"
            hint={(s, sel) => (sel ? '✔ 守護中' : s.playerId === g.lastTarget ? '昨晚守過' : s.playerId === me ? '自己' : '')}
          />
          <NoneButton label="今晚空守" selected={night.myDone && g.target === null} disabled={isBusy} onClick={() => act({ action: 'GUARD', targetId: NONE })} />
          {night.myDone && <Hint>✅ 已完成，等待其他人。要改的話可以重選。</Hint>}
        </>
      );
      break;
    }

    case 'WOLF': {
      const w = night.wolf!;
      const mates = (view.mySeat?.mates || []).map(nameOf);
      const myPick = w.picks[me];
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
            <strong style={{ color: '#ffffff' }}>🐺 狼人，請和隊友選出今晚的刀口</strong>
            <Hint>{mates.length > 0 ? `隊友：${mates.join('、')}。` : '你是唯一的狼人。'}所有存活狼人選同一個人才會鎖定，也可以一起空刀。</Hint>
          </div>
          <PickList
            seats={aliveSeats}
            selectedId={myPick && myPick !== NONE ? myPick : undefined}
            disabled={isBusy}
            onPick={id => act({ action: 'WOLF_PICK', targetId: id })}
            hint={s => {
              const pickers = Object.entries(w.picks).filter(([, t]) => t === s.playerId).map(([id]) => (id === me ? '你' : nameOf(id)));
              return pickers.length > 0 ? `🐺 ${pickers.join('、')}` : '';
            }}
          />
          <NoneButton label="空刀（不殺人）" selected={myPick === NONE} disabled={isBusy} onClick={() => act({ action: 'WOLF_PICK', targetId: NONE })} />
          {Object.entries(w.picks).some(([id, t]) => id !== me && t === NONE) && <Hint>有隊友選了空刀</Hint>}
          <Hint>{w.locked ? '✅ 刀口已鎖定，等待其他人。隊友改選的話會重新鎖定。' : '⏳ 還沒有一致的選擇…'}</Hint>
        </>
      );
      break;
    }

    case 'SEER': {
      const checks = view.mySeat?.seerChecks || [];
      const today = checks.find(c => c.round === view.round);
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <strong style={{ color: '#ffffff' }}>🔮 預言家，請選擇今晚查驗的人</strong>
          </div>
          {today ? (
            <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '20px 16px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>{nameOf(today.targetId)} 是</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: today.isWolf ? 'var(--accent-magenta)' : 'var(--accent-emerald)', margin: '4px 0' }}>
                {today.isWolf ? '🐺 狼人' : '👍 好人'}
              </div>
              <Hint>✅ 已完成，等待其他人。</Hint>
            </div>
          ) : (
            <PickList seats={others} disabled={isBusy} onPick={id => act({ action: 'SEER_CHECK', targetId: id })} accent="var(--accent-cyan)" />
          )}
          {checks.filter(c => c.round !== view.round).length > 0 && (
            <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>歷次查驗</div>
              {checks.filter(c => c.round !== view.round).map(c => (
                <div key={c.round} className="flex-between" style={{ padding: '3px 0', color: '#ffffff' }}>
                  <span>第 {c.round} 夜・{nameOf(c.targetId)}</span>
                  <span style={{ color: c.isWolf ? 'var(--accent-magenta)' : 'var(--accent-emerald)' }}>{c.isWolf ? '狼人' : '好人'}</span>
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
            <Hint>選一位你目前最懷疑是狼人的人。只是記錄，不會影響遊戲；終局會頒發「最佳偵探」給懷疑最準的人。</Hint>
          </div>
          <PickList
            seats={others}
            selectedId={night.reflectTarget}
            disabled={isBusy}
            onPick={id => act({ action: 'REFLECT', targetId: id })}
            accent="var(--accent-yellow)"
            hint={(s, sel) => (sel ? '🔎 懷疑中' : '')}
          />
          {night.myDone && <Hint>✅ 已完成，等待其他人。要改的話可以重選。</Hint>}
        </>
      );
      break;

    case 'WITCH': {
      const wi = night.witch!;
      const potions = view.mySeat?.potions;
      const victimIsMe = wi.victimId === me;
      if (night.myDone) {
        body = <div className="card text-center shrink-0 mb-md" style={{ padding: '16px' }}><span style={{ color: '#ffffff' }}>✅ 已完成，等待其他人閉眼</span></div>;
        break;
      }
      body = (
        <>
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <strong style={{ color: '#ffffff' }}>🧪 女巫，輪到你了</strong>
            <Hint>
              {!wi.victimKnown
                ? '你的解藥已經用完，看不到今晚誰被刀。'
                : wi.victimId
                  ? `今晚 ${nameOf(wi.victimId)} 被狼人刀了。`
                  : '今晚平安，狼人沒有刀人。'}
            </Hint>
            <Hint>藥水：解藥 {potions?.antidote ? '✔ 還有' : '✘ 已用'}・毒藥 {potions?.poison ? '✔ 還有' : '✘ 已用'}。一晚只能用一瓶。</Hint>
          </div>
          {poisonMode ? (
            <>
              <div style={{ color: '#ffffff', fontWeight: 800, marginBottom: '8px' }}>☠️ 選擇要毒的人</div>
              <PickList seats={others} disabled={isBusy} onPick={id => act({ action: 'WITCH', choice: 'POISON', targetId: id })} />
              <NoneButton label="← 回上一步" onClick={() => setPoisonMode(false)} />
            </>
          ) : (
            <div className="flex-col gap-sm shrink-0 mb-md">
              <button
                onClick={() => act({ action: 'WITCH', choice: 'SAVE' })}
                disabled={isBusy || !potions?.antidote || !wi.victimId || victimIsMe}
                className="btn btn-primary btn-large btn-full"
              >
                💊 使用解藥救 {wi.victimId ? nameOf(wi.victimId) : ''}
              </button>
              {victimIsMe && wi.victimKnown && <Hint>女巫不能自救。</Hint>}
              <button onClick={() => setPoisonMode(true)} disabled={isBusy || !potions?.poison} className="btn btn-secondary btn-large btn-full">
                ☠️ 使用毒藥
              </button>
              <button onClick={() => act({ action: 'WITCH', choice: 'NONE' })} disabled={isBusy} className="btn btn-ghost btn-full">
                什麼都不用
              </button>
            </div>
          )}
        </>
      );
      break;
    }

    case 'ACK':
      body = (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '20px 16px' }}>
          <p style={{ color: 'var(--fg-secondary)', margin: '0 0 14px' }}>夜晚進行中，請保持安靜</p>
          {night.myDone ? (
            <span style={{ color: '#ffffff', fontWeight: 800 }}>✅ 已閉眼，等待其他人</span>
          ) : (
            <button onClick={() => act({ action: 'NIGHT_ACK' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              😴 繼續閉眼
            </button>
          )}
        </div>
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
