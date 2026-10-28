'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { wordManagerInstance } from '@/lib/wordManager';
import { Role } from '@/types/game';
import { SpyAction, SpyRoomView, SpySeatView } from '@/types/spyRoom';

interface SpyRoomGameProps {
  view: SpyRoomView;
  isBusy: boolean;
  onAct: (action: SpyAction) => Promise<boolean>;
  onLeave: () => void;
  serverNow: () => number;
}

const ROLE_LABEL: Record<Role, { text: string; className: string }> = {
  CIVILIAN: { text: '👤 平民', className: 'badge badge-role-civ' },
  SPY: { text: '🕵️ 間諜', className: 'badge badge-role-spy' },
  BLANK: { text: '❓ 白板', className: 'badge badge-role-blank' }
};

const DIFF_LABEL = { easy: '簡單', medium: '中等', hard: '困難' } as const;

// 按住才顯示自己的詞，放開立刻遮住
const HoldToPeek: React.FC<{ word: string; compact?: boolean; onFirstReveal?: () => void }> = ({ word, compact, onFirstReveal }) => {
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
      <button
        onPointerDown={handleDown}
        onContextMenu={e => e.preventDefault()}
        className="btn btn-secondary"
        style={{ fontSize: '0.82rem', padding: '6px 12px', userSelect: 'none', touchAction: 'none', minWidth: '120px' }}
      >
        {holding ? <strong className="text-cyan">{word}</strong> : '🔒 按住看我的詞'}
      </button>
    );
  }

  return (
    <div style={{ userSelect: 'none' }} onContextMenu={e => e.preventDefault()}>
      {holding ? (
        <div className="secret-result-box">
          <div className="text-code" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan-light)' }}>YOUR SECRET WORD</div>
          <div className="secret-word-display">{word}</div>
        </div>
      ) : (
        <>
          <div className="fingerprint-zone" onPointerDown={handleDown} style={{ touchAction: 'none' }}>
            <span style={{ fontSize: '3rem' }}>👆</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>按住看詞，放開就會遮住，別讓旁邊的人看到</p>
        </>
      )}
    </div>
  );
};

const SpeakTimer: React.FC<{ startedAt: number; seconds: number; serverNow: () => number; isMine: boolean }> = ({ startedAt, seconds, serverNow, isMine }) => {
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

export const SpyRoomGame: React.FC<SpyRoomGameProps> = ({ view, isBusy, onAct, onLeave, serverNow }) => {
  const isHost = view.me.isHost;
  const mySeat = view.mySeat;
  const nameOf = (id: string | null) => view.seats.find(s => s.playerId === id)?.name || '—';
  const aliveSeats = view.seats.filter(s => s.isAlive);

  // 狀態轉換時的音效
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (prevPhaseRef.current === view.phase) return;
    prevPhaseRef.current = view.phase;
    if (view.phase === 'ELIMINATED') soundManager.playEliminate();
    if (view.phase === 'RESULT') {
      if (view.winner === 'SPY') soundManager.playVictorySpy();
      else soundManager.playVictoryCivilian();
    }
  }, [view.phase, view.winner]);

  const press = (action: SpyAction) => {
    soundManager.playClick();
    onAct(action);
  };

  const header = (
    <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
      <div className="flex-col">
        <span className="badge badge-classified">
          {view.phase === 'RESULT' ? '對局結束' : view.phase === 'REVEAL' ? '看詞中' : `第 ${view.round} 輪`}
        </span>
        <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>{view.roomId}</span>
      </div>
      {mySeat && view.phase !== 'REVEAL' && view.phase !== 'RESULT' && <HoldToPeek word={mySeat.word} compact />}
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

  // 旁觀者（中途加入）
  if (!mySeat && view.phase !== 'RESULT') {
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center" style={{ padding: '24px 16px' }}>
          <div style={{ fontSize: '2.4rem' }}>👀</div>
          <h3 style={{ color: '#ffffff', margin: '8px 0' }}>這局已經開始了</h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>你目前是旁觀者，房主開下一局時就會加入。</p>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '10px' }}>
            存活：{aliveSeats.map(s => s.name).join('、')}
          </p>
        </div>
        <div className="mt-auto">{footer}</div>
      </div>
    );
  }

  // 1. 看詞
  if (view.phase === 'REVEAL') {
    const readyCount = view.seats.filter(s => s.ready && !s.left).length;
    const total = view.seats.filter(s => !s.left).length;
    return (
      <RevealPhase
        header={header}
        word={mySeat!.word}
        ready={mySeat!.ready}
        wordInfo={view.wordInfo}
        readyCount={readyCount}
        total={total}
        waiting={view.seats.filter(s => !s.ready && !s.left)}
        onReady={() => press({ action: 'READY' })}
        hostBar={hostBar(
          <button onClick={() => press({ action: 'CONTINUE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
            不等了，直接開始發言
          </button>
        )}
        footer={footer}
      />
    );
  }

  // 2. 輪流描述
  if (view.phase === 'DESCRIBE') {
    const speakerId = view.speakQueue[view.speakIndex];
    const isMyTurn = speakerId === view.me.id;
    return (
      <div className="view-container view-enter">
        {header}
        <div className={`card text-center shrink-0 mb-md ${isMyTurn ? 'card-hero-highlight' : ''}`} style={{ padding: '22px 16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>{isMyTurn ? '輪到你了！' : '正在描述'}</div>
          <h2 style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 900, margin: '6px 0' }}>{nameOf(speakerId)}</h2>
          {view.config.speechTime > 0 && (
            <SpeakTimer startedAt={view.speakStartedAt} seconds={view.config.speechTime} serverNow={serverNow} isMine={isMyTurn} />
          )}
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', margin: '8px 0 0' }}>
            {isMyTurn ? '用一句話描述你的詞，別說得太白，也別讓人覺得你可疑' : '仔細聽，誰的描述跟你的詞對不上？'}
          </p>
          {isMyTurn && (
            <button onClick={() => press({ action: 'NEXT_SPEAKER' })} disabled={isBusy} className="btn btn-primary btn-large btn-full" style={{ marginTop: '16px' }}>
              ✅ 我說完了
            </button>
          )}
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>本輪發言順序</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {view.speakQueue.map((id, i) => {
              const seat = view.seats.find(s => s.playerId === id);
              const done = i < view.speakIndex;
              const current = i === view.speakIndex;
              return (
                <span
                  key={id}
                  className="badge"
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.82rem',
                    background: current ? 'var(--accent-cyan)' : 'var(--bg-elevated)',
                    color: current ? '#001018' : done || !seat?.isAlive ? 'var(--fg-muted)' : '#ffffff',
                    textDecoration: !seat?.isAlive ? 'line-through' : undefined
                  }}
                >
                  {done ? '✓ ' : ''}{seat?.name || '—'}
                </span>
              );
            })}
          </div>
        </div>

        {!mySeat!.isAlive && <DeadNotice />}
        <div className="mt-auto flex-col gap-sm">
          {!isMyTurn && hostBar(
            <button onClick={() => press({ action: 'NEXT_SPEAKER' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              換下一位發言
            </button>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // 3. 投票
  if (view.phase === 'VOTE') {
    const canVote = mySeat!.isAlive;
    const votedCount = aliveSeats.filter(s => s.hasVoted).length;
    const candidates = view.seats.filter(s => view.candidates.includes(s.playerId) && s.playerId !== view.me.id);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="text-center shrink-0 mb-md">
          <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>
            {view.voteAttempt > 0 ? '⚖️ 平票！重新投票' : '🗳️ 投出你懷疑的人'}
          </h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            {view.voteAttempt > 0
              ? `只能在 ${view.candidates.map(nameOf).join('、')} 之間選，再平票本輪就沒人出局`
              : '全部人投完會自動開票，投完前都可以改票'}
          </p>
          <div className="text-code text-cyan" style={{ marginTop: '8px', fontWeight: 800 }}>已投 {votedCount} / {aliveSeats.length}</div>
        </div>

        {canVote ? (
          <div className="flex-col gap-sm shrink-0 mb-md">
            {candidates.map(s => {
              const selected = view.myVote === s.playerId;
              return (
                <button
                  key={s.playerId}
                  onClick={() => press({ action: 'VOTE', targetId: s.playerId })}
                  disabled={isBusy}
                  className="card flex-between"
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderColor: selected ? 'var(--accent-magenta)' : undefined,
                    boxShadow: selected ? 'var(--shadow-glow-magenta)' : undefined
                  }}
                >
                  <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>{s.name}</span>
                  <span style={{ fontSize: '0.85rem', color: selected ? 'var(--accent-magenta)' : 'var(--fg-muted)' }}>
                    {selected ? '🎯 已投他' : s.hasVoted ? '已投票' : '尚未投票'}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <DeadNotice text="你已出局，不能投票。等其他人投完吧。" />
        )}

        <div className="mt-auto flex-col gap-sm">
          {hostBar(
            <button onClick={() => press({ action: 'CLOSE_VOTE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              不等了，用目前票數開票（{votedCount}/{aliveSeats.length}）
            </button>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // 4. 開票結果
  if (view.phase === 'ELIMINATED') {
    const elim = view.lastElimination;
    const outId = elim?.playerId ?? null;
    const iAmOut = outId === view.me.id;
    const tallyRows = Object.entries(elim?.tally || {}).sort((a, b) => b[1] - a[1]);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '24px 16px' }}>
          {outId ? (
            <>
              <div style={{ fontSize: '2.6rem' }}>{iAmOut ? '💀' : '🚪'}</div>
              <h2 style={{ color: '#ffffff', fontSize: '1.8rem', fontWeight: 900, margin: '6px 0' }}>
                {iAmOut ? '你被投出局了' : `${nameOf(outId)} 出局`}
              </h2>
              {elim?.role ? (
                <span className={ROLE_LABEL[elim.role].className} style={{ fontSize: '0.95rem', padding: '6px 14px' }}>
                  身分：{ROLE_LABEL[elim.role].text}
                </span>
              ) : (
                <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>身分保密，對局結束才公開</p>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '2.6rem' }}>🤝</div>
              <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, margin: '6px 0' }}>再次平票，本輪沒人出局</h2>
            </>
          )}
          {view.winner && (
            <p className="text-yellow" style={{ fontWeight: 800, marginTop: '12px' }}>勝負已分！房主可以公布結果</p>
          )}
        </div>

        {tallyRows.length > 0 && (
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>得票</div>
            {tallyRows.map(([id, count]) => (
              <div key={id} className="flex-between" style={{ padding: '4px 0', color: '#ffffff' }}>
                <span>{nameOf(id)}</span>
                <span className="text-code text-magenta">{count} 票</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              {view.winner ? '🏁 公布結果' : `▶️ 開始第 ${view.round + 1} 輪`}
            </button>
          ) : (
            <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>⏳ 等待房主繼續…</div>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // 5. 終局
  const winnerText = view.winner === 'SPY' ? '🕵️ 間諜獲勝' : view.winner === 'BLANK' ? '❓ 白板獲勝' : '👤 平民獲勝';
  const myRole = view.seats.find(s => s.playerId === view.me.id)?.role;
  const iWon = !!myRole && myRole === view.winner;
  return (
    <div className="view-container view-enter">
      {header}
      <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '24px 16px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>{winnerText}</h1>
        <p style={{ color: 'var(--fg-secondary)', margin: '6px 0 12px' }}>{view.winReason}</p>
        {myRole && <div style={{ fontWeight: 800, color: iWon ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>{iWon ? '🎉 你贏了！' : '😵 你輸了'}</div>}
        {view.wordPair && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <span className="badge badge-role-civ" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>平民詞：{view.wordPair.civilian}</span>
            <span className="badge badge-role-spy" style={{ padding: '6px 12px', fontSize: '0.9rem' }}>間諜詞：{view.wordPair.spy}</span>
          </div>
        )}
      </div>

      <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        {view.seats.map(s => <ResultRow key={s.playerId} seat={s} isMe={s.playerId === view.me.id} />)}
      </div>

      <div className="mt-auto flex-col gap-sm">
        {isHost ? (
          <>
            <button onClick={() => press({ action: 'START', customWords: wordManagerInstance.getCustomWords() })} disabled={isBusy || view.players.length < 3} className="btn btn-primary btn-large btn-full">
              🔁 同一批人再來一局
            </button>
            <button onClick={() => press({ action: 'BACK_TO_LOBBY' })} className="btn btn-secondary btn-full">
              回房間改設定
            </button>
          </>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>⏳ 等待房主開下一局…</div>
        )}
        {footer}
      </div>
    </div>
  );
};

const RevealPhase: React.FC<{
  header: React.ReactNode;
  word: string;
  ready: boolean;
  wordInfo: SpyRoomView['wordInfo'];
  readyCount: number;
  total: number;
  waiting: SpySeatView[];
  onReady: () => void;
  hostBar: React.ReactNode;
  footer: React.ReactNode;
}> = ({ header, word, ready, wordInfo, readyCount, total, waiting, onReady, hostBar, footer }) => {
  const [seen, setSeen] = useState(false);
  return (
    <div className="view-container view-enter">
      {header}
      <div className="scanner-card shrink-0 mb-md">
        <div className="badge badge-classified mb-sm">🔒 你的秘密詞</div>
        <HoldToPeek word={word} onFirstReveal={() => setSeen(true)} />
        {wordInfo && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
            <span className="badge badge-cyan">{wordInfo.category}</span>
            <span className="badge badge-medium">難度：{DIFF_LABEL[wordInfo.difficulty]}</span>
          </div>
        )}
      </div>

      <div className="shrink-0 mb-md">
        {ready ? (
          <div className="card text-center" style={{ padding: '14px' }}>
            <div style={{ color: '#ffffff', fontWeight: 800 }}>✅ 你已準備好（{readyCount}/{total}）</div>
            {waiting.length > 0 && (
              <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                還在看詞：{waiting.map(s => s.name).join('、')}
              </div>
            )}
          </div>
        ) : (
          <button onClick={onReady} disabled={!seen} className="btn btn-primary btn-large btn-full">
            {seen ? '我記住了' : '先按住上方看詞'}
          </button>
        )}
      </div>

      <div className="mt-auto flex-col gap-sm">
        {hostBar}
        {footer}
      </div>
    </div>
  );
};

const DeadNotice: React.FC<{ text?: string }> = ({ text }) => (
  <div className="card text-center shrink-0 mb-md" style={{ padding: '14px', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
    <span style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>{text || '💀 你已出局，可以繼續旁聽，但別透露你的詞！'}</span>
  </div>
);

const ResultRow: React.FC<{ seat: SpySeatView; isMe: boolean }> = ({ seat, isMe }) => (
  <div className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', gap: '8px' }}>
    <div className="flex-col">
      <span style={{ color: seat.isAlive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
        {seat.name}{isMe ? '（你）' : ''}{seat.left ? '（已離開）' : ''}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
        {seat.isAlive ? '存活到最後' : `第 ${seat.eliminatedRound} 輪出局`} · {seat.word}
      </span>
    </div>
    {seat.role && <span className={ROLE_LABEL[seat.role].className}>{ROLE_LABEL[seat.role].text}</span>}
  </div>
);
