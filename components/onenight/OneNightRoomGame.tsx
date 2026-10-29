'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { deckSummary } from '@/lib/oneNightEngine';
import { OneNightAction, OneNightEvent, OneNightRoomView } from '@/types/oneNightRoom';
import { OneNightNight } from './OneNightNight';
import {
  centerName,
  DayTimer,
  eventText,
  HoldReveal,
  IntelList,
  PickList,
  RoleBadge,
  RoleCardBody,
  ROLE_INFO,
  useDayExpired
} from './onenightShared';

interface OneNightRoomGameProps {
  view: OneNightRoomView;
  isBusy: boolean;
  onAct: (action: OneNightAction) => Promise<boolean>;
  onLeave: () => void;
  serverNow: () => number;
}

export const OneNightRoomGame: React.FC<OneNightRoomGameProps> = ({ view, isBusy, onAct, onLeave, serverNow }) => {
  const isHost = view.me.isHost;
  const mySeat = view.mySeat;
  const isNight = view.phase === 'NIGHT';
  const nameOf = (id: string | null | undefined) =>
    view.seats.find(s => s.playerId === id)?.name || view.players.find(p => p.id === id)?.name || '—';
  // 是否已按住看過自己的牌（每局重置）
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (view.phase === 'REVEAL') setSeen(false);
  }, [view.phase]);
  const dayExpired = useDayExpired(view.dayStartedAt, view.config.dayMinutes, serverNow);

  // 階段切換音效（全員同步播，不會洩漏個人資訊）
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (prevPhaseRef.current === view.phase) return;
    prevPhaseRef.current = view.phase;
    if (view.phase === 'NIGHT') soundManager.playHeartbeat();
    if (view.phase === 'DAY') soundManager.playRevealSecret();
    if (view.phase === 'RESULT') {
      const won = !!view.result?.rows.find(r => r.playerId === view.me.id)?.won;
      if (won) soundManager.playVictoryCivilian();
      else soundManager.playVictorySpy();
    }
  }, [view.phase, view.result, view.me.id]);

  const press = (action: OneNightAction) => {
    soundManager.playClick();
    onAct(action);
  };

  const header = (
    <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
      <div className="flex-col">
        <span className="badge badge-classified">
          {view.phase === 'RESULT' ? '對局結束' : view.phase === 'REVEAL' ? '確認身分中' : view.phase === 'NIGHT' ? '🌙 夜晚' : view.phase === 'DAY' ? '☀️ 白天討論' : '🗳️ 投票'}
        </span>
        <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>{view.roomId}</span>
      </div>
    </div>
  );

  const hostBar = (children: React.ReactNode) => isHost && (
    <div className="card shrink-0" style={{ padding: '10px 12px', borderStyle: 'dashed' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>👑 房主控制</div>
      {children}
    </div>
  );

  const footer = (
    <button onClick={onLeave} className="btn btn-ghost btn-full shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
      離開房間
    </button>
  );

  const waitHost = (text = '⏳ 等待房主繼續…') => (
    <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>{text}</div>
  );

  const content = renderPhase();

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        transition: 'background 0.8s ease',
        background: isNight
          ? 'linear-gradient(180deg, #010208 0%, #060a1c 100%)'
          : 'linear-gradient(180deg, #2c3b5e 0%, #141c2e 55%)'
      }}
    >
      {content}
    </div>
  );

  function renderPhase(): React.ReactNode {
    // 旁觀者（中途加入）
    if (!mySeat && view.phase !== 'RESULT') {
      return (
        <div className="view-container view-enter">
          {header}
          <div className="card text-center" style={{ padding: '24px 16px' }}>
            <div style={{ fontSize: '2.4rem' }}>👀</div>
            <h3 style={{ color: '#ffffff', margin: '8px 0' }}>這局已經開始了</h3>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>你目前是旁觀者，房主開下一局時就會加入。</p>
          </div>
          <div className="mt-auto">{footer}</div>
        </div>
      );
    }

    switch (view.phase) {
      case 'REVEAL': return renderReveal();
      case 'NIGHT':
        return <OneNightNight view={view} isBusy={isBusy} onAct={onAct} header={header} footer={footer} hostBar={renderNightHostBar()} />;
      case 'DAY': return renderDay();
      case 'VOTE': return renderVote();
      default: return renderResult();
    }
  }

  function renderNightHostBar() {
    const p = view.night?.progress;
    return hostBar(
      <button onClick={() => onAct({ action: 'FORCE_NIGHT' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
        強制天亮（{p?.done ?? 0}/{p?.total ?? 0}，沒做完的人視為放棄行動）
      </button>
    );
  }

  function setupText() {
    const n = view.seats.length;
    return deckSummary(view.config, n).roles.map(([role, c]) => `${ROLE_INFO[role].name}${c > 1 ? `×${c}` : ''}`).join('・');
  }

  // ───────── 確認身分 ─────────
  function renderReveal() {
    const readyCount = view.seats.filter(s => s.ready).length;
    const waiting = view.seats.filter(s => !s.ready).map(s => s.name);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="scanner-card shrink-0 mb-md">
          <div className="badge badge-classified mb-sm">🔒 你的初始身分</div>
          <HoldReveal label="按住看身分" onFirstReveal={() => setSeen(true)}>
            <RoleCardBody role={mySeat!.initial} title="YOUR ROLE" showNight />
          </HoldReveal>
          <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: '10px' }}>
            牌庫（{view.seats.length + 3} 張，3 張在中央）：{setupText()}
          </p>
        </div>

        <div className="shrink-0 mb-md">
          {mySeat!.ready ? (
            <div className="card text-center" style={{ padding: '14px' }}>
              <div style={{ color: '#ffffff', fontWeight: 800 }}>✅ 你已準備好（{readyCount}/{view.seats.length}）</div>
              {waiting.length > 0 && <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '6px' }}>還在確認：{waiting.join('、')}</div>}
            </div>
          ) : (
            <button onClick={() => press({ action: 'READY' })} disabled={!seen} className="btn btn-primary btn-large btn-full">
              {seen ? '我記住了，準備好了' : '先按住上方看身分'}
            </button>
          )}
        </div>

        <div className="mt-auto flex-col gap-sm">
          {hostBar(
            <button onClick={() => press({ action: 'FORCE_NIGHT' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              不等了，直接天黑
            </button>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 白天 ─────────
  function renderDay() {
    const iAmInsomniac = view.intel.some(i => i.kind === 'INSOMNIAC');
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>☀️ 天亮了，自由討論</div>
          <DayTimer startedAt={view.dayStartedAt} minutes={view.config.dayMinutes} serverNow={serverNow} />
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
            大家都不知道自己現在拿的是什麼牌（除了失眠者）。說出你知道的，找出誰是狼！
          </p>
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '14px' }}>
          <div className="text-center" style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>
            🔒 只有你看得到
          </div>
          <HoldReveal label="按住查看我的資訊" silent>
            <div style={{ textAlign: 'left' }}>
              <div className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan-light)' }}>你的初始身分</div>
              <div style={{ color: '#ffffff', fontWeight: 800, margin: '2px 0 10px' }}>
                {ROLE_INFO[mySeat!.initial].emoji} {ROLE_INFO[mySeat!.initial].name}
                {!iAmInsomniac && <span style={{ fontWeight: 400, color: 'var(--fg-muted)', fontSize: '0.8rem' }}>（現在不一定還是）</span>}
              </div>
              <IntelList intel={view.intel} nameOf={nameOf} />
            </div>
          </HoldReveal>
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>場上牌庫（含 3 張中央牌）</div>
          <div style={{ color: '#ffffff', fontSize: '0.9rem' }}>{setupText()}</div>
        </div>

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <button onClick={() => press({ action: 'START_VOTE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              🗳️ {dayExpired ? '時間到，開始投票' : '提前結束討論，開始投票'}
            </button>
          ) : dayExpired ? (
            <button onClick={() => press({ action: 'START_VOTE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              ⏰ 時間到，開始投票
            </button>
          ) : waitHost('⏳ 討論中，房主會決定何時開始投票')}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 投票 ─────────
  function renderVote() {
    const others = view.seats.filter(s => s.playerId !== view.me.id);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '18px 16px' }}>
          <div style={{ fontSize: '2rem' }}>🗳️</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>投票：你覺得誰是狼人？</h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            得票最高的人出局（平票則全部出局）。全部人投完會自動開票，投完前都可以改票。
          </p>
          <div className="text-code text-cyan" style={{ marginTop: '8px', fontWeight: 800 }}>已投 {view.votedCount} / {view.seats.length}</div>
        </div>

        <PickList
          players={others}
          selectedIds={[view.myVote]}
          disabled={isBusy}
          onPick={id => press({ action: 'VOTE', targetId: id })}
          hint={(id, sel) => (sel ? '🎯 已投他' : view.seats.find(s => s.playerId === id)?.hasVoted ? '已投票' : '尚未投票')}
        />

        <div className="mt-auto flex-col gap-sm">
          {hostBar(
            <button onClick={() => press({ action: 'CLOSE_VOTE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              不等了，用目前票數開票（{view.votedCount}/{view.seats.length}）
            </button>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 終局 ─────────
  function renderResult() {
    const result = view.result;
    if (!result) return <div className="view-container">{header}{waitHost('⏳ 結算中…')}</div>;
    const o = result.outcome;
    const myRow = result.rows.find(r => r.playerId === view.me.id);
    const winnerText = o.winner === 'WOLF' ? '🐺 狼人陣營獲勝' : '🎉 好人陣營獲勝';
    const hits = result.bestIntuition;
    const isSwap = (e: OneNightEvent) => e.type === 'ROBBER' || e.type === 'TROUBLEMAKER' || e.type === 'DRUNK';
    const swapEvents = result.events.filter(isSwap);
    const infoEvents = result.events.filter(e => !isSwap(e));
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '24px 16px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>{winnerText}</h1>
          <p style={{ color: 'var(--fg-secondary)', margin: '6px 0 12px' }}>{o.reason}</p>
          <div style={{ color: '#ffffff', fontWeight: 700 }}>
            出局：{o.outIds.length > 0 ? o.outIds.map(nameOf).join('、') : '沒有人'}
            {o.hunterShotId && <div style={{ fontSize: '0.85rem', color: 'var(--accent-yellow)' }}>🏹 獵人 {nameOf(o.hunterId)} 帶走了 {nameOf(o.hunterShotId)}</div>}
          </div>
          {myRow && <div style={{ fontWeight: 800, marginTop: '10px', color: myRow.won ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>{myRow.won ? '🎉 你贏了！' : '😵 你輸了'}</div>}
        </div>

        <div className="card text-center shrink-0 mb-md" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>🧠 最佳直覺（夜間猜測猜中初始狼人）</div>
          <div style={{ color: hits.length > 0 ? 'var(--accent-yellow)' : 'var(--fg-muted)', fontWeight: 900, fontSize: '1.1rem', marginTop: '4px' }}>
            {hits.length > 0
              ? hits.map(h => `${nameOf(h.playerId)}（猜中 ${nameOf(h.targetId)}）`).join('、')
              : result.guessTotal > 0 ? `${result.guessTotal} 人猜了，沒有人猜中` : '這局沒有人做夜間猜測'}
          </div>
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>所有人的牌（初始 → 最終）與投票</div>
          {result.rows.map(r => (
            <div key={r.playerId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex-between" style={{ gap: '8px' }}>
                <span style={{ color: r.isOut ? 'var(--accent-magenta)' : '#ffffff', fontWeight: 700 }}>
                  {r.isOut ? '💀 ' : ''}{r.name}{r.playerId === view.me.id ? '（你）' : ''}{r.won ? ' 🏆' : ''}
                </span>
                <span className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-magenta)' }}>{r.votesReceived} 票</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                <RoleBadge role={r.initial} />
                <span style={{ color: 'var(--fg-muted)' }}>→</span>
                <RoleBadge role={r.final} />
                <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginLeft: 'auto' }}>
                  {r.voteFor ? `投給 ${nameOf(r.voteFor)}` : '沒有投票'}
                </span>
              </div>
            </div>
          ))}
          <div style={{ padding: '8px 0 2px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>中央牌（初始 → 最終）</div>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
                <span style={{ color: 'var(--fg-secondary)', fontSize: '0.8rem', minWidth: '84px' }}>{centerName(i)}</span>
                <RoleBadge role={result.initialCenter[i]} />
                <span style={{ color: 'var(--fg-muted)' }}>→</span>
                <RoleBadge role={result.finalCenter[i]} />
              </div>
            ))}
          </div>
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>📖 夜晚發生的事</div>
          {infoEvents.length + swapEvents.length === 0 && <div style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>這晚沒有人使用技能</div>}
          {infoEvents.map((e, i) => <div key={`i${i}`} style={{ color: '#ffffff', fontSize: '0.85rem', padding: '2px 0' }}>{eventText(e, nameOf)}</div>)}
          {swapEvents.length > 0 && <div style={{ color: 'var(--accent-cyan-light)', fontWeight: 800, fontSize: '0.85rem', marginTop: '6px' }}>換牌（依 強盜 → 搗蛋鬼 → 酒鬼 順序）</div>}
          {swapEvents.map((e, i) => <div key={`s${i}`} style={{ color: '#ffffff', fontSize: '0.85rem', padding: '2px 0' }}>{eventText(e, nameOf)}</div>)}
        </div>

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <>
              <button onClick={() => press({ action: 'START' })} disabled={isBusy || view.players.length < 3} className="btn btn-primary btn-large btn-full">
                🔁 同一批人再來一局
              </button>
              <button onClick={() => press({ action: 'BACK_TO_LOBBY' })} className="btn btn-secondary btn-full">
                回房間改設定
              </button>
            </>
          ) : waitHost('⏳ 等待房主開下一局…')}
          {footer}
        </div>
      </div>
    );
  }
};
