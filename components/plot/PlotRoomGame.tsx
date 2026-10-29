'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { FORCED_COUP_COINS } from '@/lib/plotEngine';
import { PlotAction, PlotActionKind, PlotRoomView, PlotSeatView } from '@/types/plotRoom';
import { ACTION_INFO, CardFace, CheatSheet, RevealedChips, ROLE_INFO, TURN_ACTIONS } from './plotShared';

interface PlotRoomGameProps {
  view: PlotRoomView;
  isBusy: boolean;
  onAct: (action: PlotAction) => Promise<boolean>;
  onLeave: () => void;
}

export const PlotRoomGame: React.FC<PlotRoomGameProps> = ({ view, isBusy, onAct, onLeave }) => {
  const meId = view.me.id;
  const isHost = view.me.isHost;
  const mySeat = view.seats.find(s => s.playerId === meId);
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name || '某人';
  const myHand = mySeat?.hand ?? [];
  const isMyTurn = view.phase === 'TURN' && view.turnId === meId && !!mySeat?.alive;

  const [pickKind, setPickKind] = useState<PlotActionKind | null>(null); // 已選了要指定目標的行動
  const [keep, setKeep] = useState<number[]>([]);

  // 換階段或換人時，清掉還沒送出的選擇
  useEffect(() => { setPickKind(null); }, [view.phase, view.turnNo]);
  useEffect(() => { setKeep([]); }, [view.exchangeId, view.phase]);

  // 音效：自己失去牌、對局結束
  const prevCardsRef = useRef(mySeat?.cardsLeft ?? 0);
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    const left = mySeat?.cardsLeft ?? 0;
    if (left < prevCardsRef.current) soundManager.playEliminate();
    prevCardsRef.current = left;
    if (prevPhaseRef.current !== view.phase) {
      prevPhaseRef.current = view.phase;
      if (view.phase === 'RESULT') {
        if (view.winnerId === meId) soundManager.playVictoryCivilian();
        else soundManager.playRevealSecret();
      }
    }
  }, [mySeat?.cardsLeft, view.phase, view.winnerId, meId]);

  const send = (action: PlotAction) => {
    soundManager.playClick();
    onAct(action);
  };

  // ───────── 共用區塊 ─────────

  const alivePlayers = view.seats.filter(s => s.alive);

  const board = (
    <div className="flex-col gap-sm shrink-0 mb-md">
      {view.seats.map(s => (
        <SeatRow
          key={s.playerId}
          seat={s}
          isMe={s.playerId === meId}
          isTurn={view.phase !== 'RESULT' && view.turnId === s.playerId}
          waiting={!!view.respond?.waitingIds.includes(s.playerId)}
        />
      ))}
    </div>
  );

  const header = (
    <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
      <div className="flex-col">
        <span className="badge badge-classified">
          {view.phase === 'RESULT' ? '對局結束' : `第 ${view.turnNo} 回合`}
        </span>
        <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>
          {view.roomId} · 存活 {alivePlayers.length}/{view.seats.length} · 牌庫 {view.deckCount}
        </span>
      </div>
      {mySeat && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--accent-yellow)', fontWeight: 900, fontSize: '1.3rem' }}>🪙 {mySeat.coins}</div>
        </div>
      )}
    </div>
  );

  const logCard = view.log.length > 0 && (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 14px' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>📜 行動紀錄</div>
      {[...view.log].reverse().map((line, i) => (
        <div key={i} style={{ fontSize: '0.82rem', color: i === 0 ? '#ffffff' : 'var(--fg-secondary)', padding: '2px 0' }}>{line}</div>
      ))}
    </div>
  );

  const footer = (
    <button onClick={onLeave} className="btn btn-ghost btn-full shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
      離開房間
    </button>
  );

  const hostBar = isHost && view.phase !== 'RESULT' && (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 12px', borderStyle: 'dashed' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>👑 房主控制</div>
      <button onClick={() => send({ action: 'FORCE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
        {forceLabel()}
      </button>
    </div>
  );

  function forceLabel(): string {
    switch (view.phase) {
      case 'RESPOND': return `強制放行（還在等：${(view.respond?.waitingIds ?? []).map(nameOf).join('、') || '—'}）`;
      case 'TURN': return `強制 ${nameOf(view.turnId)} 行動（收入，滿 10 金則政變）`;
      case 'LOSE_CARD': return `強制 ${nameOf(view.loseId)} 隨機翻開一張牌`;
      case 'EXCHANGE': return `強制 ${nameOf(view.exchangeId)} 維持原本的牌`;
      default: return '強制推進';
    }
  }

  // 自己的牌
  function renderMyHand(onPick?: (index: number) => void) {
    if (!mySeat) return null;
    return (
      <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>
          🎴 你的牌（只有你看得到）{!mySeat.alive && '・已淘汰'}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {myHand.map((c, i) => (
            <CardFace
              key={i}
              role={c.role}
              revealed={c.revealed}
              onClick={onPick && !c.revealed ? () => onPick(i) : undefined}
              selected={!!onPick && !c.revealed}
            />
          ))}
        </div>
      </div>
    );
  }

  // ───────── 主要狀態區 ─────────

  function describePending(): string {
    const p = view.pending;
    const r = view.respond;
    if (!p) return '';
    const actor = nameOf(p.actorId);
    const target = nameOf(p.targetId);
    const label = ACTION_INFO[p.kind].label;
    if (r?.stage === 'BLOCK' && r.claimRole) {
      return `${nameOf(r.claimerId)} 宣稱 ${ROLE_INFO[r.claimRole].emoji}${ROLE_INFO[r.claimRole].name}，阻擋 ${actor} 的「${label}」`;
    }
    switch (p.kind) {
      case 'AID': return `${actor} 想領外援（+2 金）`;
      case 'TAX': return `${actor} 宣稱 ${ROLE_INFO.TAX.emoji}稅務官，收稅 +3 金`;
      case 'ASSASSINATE': return `${actor} 宣稱 ${ROLE_INFO.ASSASSIN.emoji}刺客，付 3 金刺殺 ${target}`;
      case 'THIEF': return `${actor} 宣稱 ${ROLE_INFO.THIEF.emoji}盜賊，向 ${target} 拿最多 2 金`;
      case 'ENVOY': return `${actor} 宣稱 ${ROLE_INFO.ENVOY.emoji}密使，要換牌`;
      default: return `${actor} 的「${label}」`;
    }
  }

  function renderStatus(): React.ReactNode {
    switch (view.phase) {
      case 'TURN': return renderTurn();
      case 'RESPOND': return renderRespond();
      case 'LOSE_CARD': return renderLose();
      case 'EXCHANGE': return renderExchange();
      default: return null;
    }
  }

  function renderTurn() {
    if (!isMyTurn || !mySeat) {
      return (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '18px 16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>輪到</div>
          <h3 style={{ color: '#ffffff', fontSize: '1.4rem', margin: '4px 0' }}>{nameOf(view.turnId)}</h3>
          <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>選擇行動中…</div>
        </div>
      );
    }
    const forced = mySeat.coins >= FORCED_COUP_COINS;
    // 選好行動、要指定目標
    if (pickKind) {
      const info = ACTION_INFO[pickKind];
      return (
        <div className="card shrink-0 mb-md card-hero-highlight" style={{ padding: '14px 16px' }}>
          <div style={{ color: '#ffffff', fontWeight: 800, marginBottom: '8px' }}>{info.emoji} {info.label}：選擇目標</div>
          <div className="flex-col gap-sm">
            {alivePlayers.filter(s => s.playerId !== meId).map(s => {
              const noCoin = pickKind === 'THIEF' && s.coins <= 0;
              return (
                <button
                  key={s.playerId}
                  disabled={noCoin || isBusy}
                  onClick={() => { setPickKind(null); send({ action: 'DO', kind: pickKind, targetId: s.playerId }); }}
                  className="card flex-between"
                  style={{ padding: '12px 14px', cursor: noCoin ? 'not-allowed' : 'pointer', opacity: noCoin ? 0.45 : 1 }}
                >
                  <span style={{ color: '#ffffff', fontWeight: 800 }}>{s.name}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>🪙 {s.coins}・🎴 {s.cardsLeft}{noCoin ? '（沒錢可偷）' : ''}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setPickKind(null)} className="btn btn-ghost btn-full" style={{ marginTop: '8px', color: 'var(--fg-muted)' }}>返回</button>
        </div>
      );
    }
    return (
      <div className="card shrink-0 mb-md card-hero-highlight" style={{ padding: '14px 16px' }}>
        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.1rem', marginBottom: '2px' }}>輪到你了！選一個行動</div>
        {forced && <div style={{ color: 'var(--accent-magenta)', fontSize: '0.82rem', marginBottom: '6px' }}>你有 {mySeat.coins} 金，必須發動政變</div>}
        <div className="flex-col gap-sm" style={{ marginTop: '8px' }}>
          {TURN_ACTIONS.map(kind => {
            const info = ACTION_INFO[kind];
            const poor = mySeat.coins < info.cost;
            const blockedByForce = forced && kind !== 'COUP';
            const disabled = poor || blockedByForce || isBusy;
            return (
              <button
                key={kind}
                disabled={disabled}
                onClick={() => (info.needsTarget ? setPickKind(kind) : send({ action: 'DO', kind }))}
                className="btn btn-secondary btn-full"
                style={{ textAlign: 'left', opacity: disabled ? 0.4 : 1, padding: '10px 14px' }}
              >
                <div style={{ fontWeight: 800 }}>{info.emoji} {info.label}{info.cost > 0 ? `（${info.cost} 金）` : ''}{info.claim ? '・宣稱' : ''}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', fontWeight: 400 }}>{info.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderRespond() {
    const r = view.respond;
    if (!r) return null;
    const mine = r.mine;
    const claimerName = nameOf(r.claimerId);
    return (
      <div className="card shrink-0 mb-md card-hero-highlight" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{r.stage === 'BLOCK' ? '✋ 有人阻擋' : '📢 有人宣告行動'}</div>
        <div style={{ color: '#ffffff', fontWeight: 900, fontSize: '1.1rem', margin: '4px 0 8px' }}>{describePending()}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', marginBottom: '10px' }}>
          還在等：{r.waitingIds.length > 0 ? r.waitingIds.map(nameOf).join('、') : '—'}
        </div>
        {mine.waiting ? (
          <div className="flex-col gap-sm">
            <button onClick={() => send({ action: 'PASS' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">👌 放行</button>
            {mine.canChallenge && r.claimRole && (
              <button onClick={() => send({ action: 'CHALLENGE' })} disabled={isBusy} className="btn btn-secondary btn-full" style={{ borderColor: 'var(--accent-magenta)', color: 'var(--accent-magenta)' }}>
                ❗ 質疑 {claimerName} 沒有 {ROLE_INFO[r.claimRole].emoji}{ROLE_INFO[r.claimRole].name}
              </button>
            )}
            {mine.blockRoles.map(role => (
              <button key={role} onClick={() => send({ action: 'BLOCK', role })} disabled={isBusy} className="btn btn-secondary btn-full">
                ✋ 宣稱 {ROLE_INFO[role].emoji}{ROLE_INFO[role].name} 阻擋
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-muted)', fontSize: '0.88rem' }}>
            {mySeat?.alive ? (r.waitingIds.length > 0 ? '你這邊已經處理好了，等其他人回應…' : '處理中…') : '你是觀戰者'}
          </div>
        )}
      </div>
    );
  }

  function renderLose() {
    const mine = view.loseId === meId;
    return (
      <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '16px' }}>
        {view.pending && <div style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', marginBottom: '6px' }}>{describePending()}</div>}
        <h3 style={{ color: '#ffffff', fontSize: '1.2rem' }}>
          {mine ? '你要失去一張牌：點下面的牌翻開它' : `${nameOf(view.loseId)} 正在選擇要失去的牌…`}
        </h3>
      </div>
    );
  }

  function renderExchange() {
    if (view.exchangeId !== meId || !view.exchangeOptions) {
      return (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '16px' }}>
          <h3 style={{ color: '#ffffff' }}>📜 {nameOf(view.exchangeId)} 正在換牌…</h3>
        </div>
      );
    }
    const need = view.exchangeKeepCount;
    const toggle = (i: number) => setKeep(k => (k.includes(i) ? k.filter(x => x !== i) : k.length >= need ? [...k.slice(1), i] : [...k, i]));
    return (
      <div className="card shrink-0 mb-md card-hero-highlight" style={{ padding: '14px 16px' }}>
        <div style={{ color: '#ffffff', fontWeight: 900, marginBottom: '8px' }}>📜 換牌：選出 {need} 張要留下（其餘放回牌庫）</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {view.exchangeOptions.map((role, i) => (
            <CardFace key={i} role={role} small selected={keep.includes(i)} onClick={() => toggle(i)} />
          ))}
        </div>
        <button
          onClick={() => send({ action: 'EXCHANGE', keep })}
          disabled={keep.length !== need || isBusy}
          className="btn btn-primary btn-full"
          style={{ marginTop: '10px' }}
        >
          確定留下這 {need} 張（{keep.length}/{need}）
        </button>
      </div>
    );
  }

  // ───────── 結果 ─────────

  function renderResult() {
    const winner = view.seats.find(s => s.playerId === view.winnerId);
    const iWon = view.winnerId === meId;
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '24px 16px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffffff' }}>🏆 {winner ? `${winner.name} 獲勝` : '沒有勝者'}</h1>
          <p style={{ color: 'var(--fg-secondary)', margin: '6px 0' }}>最後的存活者，掌握了整個宮廷</p>
          {mySeat && <div style={{ fontWeight: 800, color: iWon ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>{iWon ? '🎉 你贏了！' : '😵 你輸了'}</div>}
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>所有人的手牌</div>
          {view.seats.map(s => (
            <div key={s.playerId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex-between" style={{ marginBottom: '6px' }}>
                <span style={{ color: s.alive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
                  {s.playerId === view.winnerId ? '🏆 ' : ''}{s.name}{s.playerId === meId ? '（你）' : ''}{s.left ? '（已離開）' : ''}
                </span>
                <span style={{ color: 'var(--accent-yellow)', fontSize: '0.85rem' }}>🪙 {s.coins}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(s.hand ?? []).map((c, i) => <CardFace key={i} role={c.role} revealed={c.revealed} small />)}
              </div>
            </div>
          ))}
        </div>

        {logCard}

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <>
              <button onClick={() => send({ action: 'START' })} disabled={isBusy || view.players.length < 2} className="btn btn-primary btn-large btn-full">
                🔁 同一批人再來一局
              </button>
              <button onClick={() => send({ action: 'BACK_TO_LOBBY' })} className="btn btn-secondary btn-full">回房間（加減人）</button>
            </>
          ) : (
            <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>⏳ 等待房主開下一局…</div>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 組合 ─────────

  if (view.phase === 'RESULT') return renderResult();

  const spectator = !view.mySeatIn;
  const eliminated = view.mySeatIn && mySeat && !mySeat.alive;
  const pickingLose = view.phase === 'LOSE_CARD' && view.loseId === meId;

  return (
    <div className="view-container view-enter">
      {header}
      {spectator && (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '12px', borderColor: 'var(--accent-cyan-light)' }}>
          <span style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>👀 這局已經開始，你先當旁觀者，下一局就會加入。</span>
        </div>
      )}
      {eliminated && (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '12px', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
          <span style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>💀 你已被淘汰，可以繼續觀戰。</span>
        </div>
      )}
      {board}
      {renderStatus()}
      {renderMyHand(pickingLose ? i => send({ action: 'LOSE_CARD', index: i }) : undefined)}
      {logCard}
      <CheatSheet />
      <div className="mt-auto">
        {hostBar}
        {footer}
      </div>
    </div>
  );
};

// 一位玩家的資訊列：金幣、暗牌數、已翻開的牌
const SeatRow: React.FC<{ seat: PlotSeatView; isMe: boolean; isTurn: boolean; waiting: boolean }> = ({ seat, isMe, isTurn, waiting }) => (
  <div
    className="card"
    style={{
      padding: '10px 12px',
      opacity: seat.alive ? 1 : 0.5,
      borderColor: isTurn ? 'var(--accent-cyan-light)' : waiting ? 'var(--accent-yellow)' : undefined,
      boxShadow: isTurn ? '0 0 14px var(--accent-cyan-light)' : undefined
    }}
  >
    <div className="flex-between" style={{ gap: '8px' }}>
      <span style={{ color: seat.alive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 800 }}>
        {isTurn ? '▶ ' : ''}{seat.name}{isMe ? '（你）' : ''}{seat.left ? '（已離開）' : !seat.alive ? ' 💀' : ''}
        {waiting && <span style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem', marginLeft: '6px' }}>回應中</span>}
      </span>
      <span style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--accent-yellow)', fontWeight: 800 }}>🪙 {seat.coins}</span>
        <span style={{ color: 'var(--fg-secondary)', marginLeft: '10px' }}>{'🎴'.repeat(seat.cardsLeft) || '—'}</span>
      </span>
    </div>
    {seat.revealed.length > 0 && (
      <div style={{ marginTop: '6px' }}><RevealedChips roles={seat.revealed} /></div>
    )}
  </div>
);
