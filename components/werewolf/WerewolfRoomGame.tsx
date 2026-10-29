'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { NONE, WerewolfAction, WerewolfEvent, WerewolfRoomView } from '@/types/werewolfRoom';
import { WerewolfNight } from './WerewolfNight';
import { DeadNotice, eventText, HoldToPeekRole, NoneButton, PickList, RoleBadge, ROLE_INFO, SpeakTimer } from './werewolfShared';

interface WerewolfRoomGameProps {
  view: WerewolfRoomView;
  isBusy: boolean;
  onAct: (action: WerewolfAction) => Promise<boolean>;
  onLeave: () => void;
  serverNow: () => number;
}

export const WerewolfRoomGame: React.FC<WerewolfRoomGameProps> = ({ view, isBusy, onAct, onLeave, serverNow }) => {
  const isHost = view.me.isHost;
  const mySeat = view.mySeat;
  const isNight = view.phase === 'NIGHT' || view.phase === 'NIGHT_WITCH';
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name || '—';
  const aliveSeats = view.seats.filter(s => s.isAlive);
  const present = view.seats.filter(s => !s.left);

  // 階段切換音效（全員同步播，不會洩漏個人資訊）
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (prevPhaseRef.current === view.phase) return;
    prevPhaseRef.current = view.phase;
    if (view.phase === 'NIGHT') soundManager.playHeartbeat();
    if (view.phase === 'DAWN') view.dawnDeaths.length > 0 ? soundManager.playEliminate() : soundManager.playRevealSecret();
    if (view.phase === 'EXILE' && view.lastExile?.playerId) soundManager.playEliminate();
    if (view.phase === 'RESULT') {
      if (view.winner === 'WOLF') soundManager.playVictorySpy();
      else soundManager.playVictoryCivilian();
    }
  }, [view.phase, view.winner, view.dawnDeaths.length, view.lastExile]);

  // 白天用，夜晚的操作不播音效
  const press = (action: WerewolfAction) => {
    soundManager.playClick();
    onAct(action);
  };

  const header = (
    <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
      <div className="flex-col">
        <span className="badge badge-classified">
          {view.phase === 'RESULT'
            ? '對局結束'
            : view.phase === 'REVEAL'
              ? '確認身分中'
              : isNight
                ? `🌙 第 ${view.round} 夜`
                : `☀️ 第 ${view.round} 天`}
        </span>
        <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>
          {view.roomId}{view.phase !== 'REVEAL' && view.phase !== 'RESULT' ? ` · 存活 ${aliveSeats.length}/${present.length}` : ''}
        </span>
      </div>
      {mySeat && view.phase !== 'REVEAL' && view.phase !== 'RESULT' && <HoldToPeekRole role={mySeat.role} compact silent={isNight} />}
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

  // 夜晚用深色背景，白天亮一點
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
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '10px' }}>存活：{aliveSeats.map(s => s.name).join('、')}</p>
          </div>
          <div className="mt-auto">{footer}</div>
        </div>
      );
    }

    switch (view.phase) {
      case 'REVEAL': return renderReveal();
      case 'NIGHT':
      case 'NIGHT_WITCH':
        return <WerewolfNight view={view} isBusy={isBusy} onAct={onAct} header={header} footer={footer} hostBar={renderNightHostBar()} />;
      case 'DAWN': return renderDawn();
      case 'HUNTER': return renderHunter();
      case 'DAY': return renderDay();
      case 'VOTE': return renderVote();
      case 'EXILE': return renderExile();
      default: return renderResult();
    }
  }

  function renderNightHostBar() {
    const p = view.night?.progress;
    return hostBar(
      <button onClick={() => onAct({ action: 'FORCE_NIGHT' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
        {view.phase === 'NIGHT' ? '強制進入女巫階段' : '強制結束夜晚'}（{p?.done ?? 0}/{p?.total ?? 0}，未行動視為放棄）
      </button>
    );
  }

  // ───────── 確認身分 ─────────
  function renderReveal() {
    const readyCount = present.filter(s => s.ready).length;
    const waiting = present.filter(s => !s.ready);
    const mates = (mySeat!.mates || []).map(nameOf);
    return (
      <RevealPhase
        header={header}
        role={mySeat!.role}
        mates={mates}
        ready={mySeat!.ready}
        readyCount={readyCount}
        total={present.length}
        waiting={waiting.map(s => s.name)}
        config={view.config}
        onReady={() => press({ action: 'READY' })}
        hostBar={hostBar(
          <button onClick={() => press({ action: 'CONTINUE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
            不等了，直接進入第一夜
          </button>
        )}
        footer={footer}
      />
    );
  }

  // ───────── 天亮 ─────────
  function renderLastWords(showSkip: boolean) {
    const lw = view.lastWords;
    if (!lw || lw.index >= lw.queue.length) return null;
    const speakerId = lw.queue[lw.index];
    const mine = speakerId === view.me.id;
    return (
      <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>📜 遺言</div>
        <h3 style={{ color: '#ffffff', fontSize: '1.4rem', margin: '6px 0' }}>請 {nameOf(speakerId)} 發表遺言</h3>
        {mine ? (
          <button onClick={() => press({ action: 'LAST_WORDS_DONE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full" style={{ marginTop: '10px' }}>
            ✅ 我說完了
          </button>
        ) : (
          showSkip && isHost && (
            <button onClick={() => press({ action: 'LAST_WORDS_DONE' })} className="btn btn-secondary btn-full" style={{ marginTop: '10px', fontSize: '0.85rem' }}>
              （房主）結束遺言
            </button>
          )
        )}
      </div>
    );
  }

  function lastWordsPending() {
    return !!view.lastWords && view.lastWords.index < view.lastWords.queue.length;
  }

  function renderDawn() {
    const deaths = view.dawnDeaths;
    const iDied = deaths.includes(view.me.id);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '24px 16px' }}>
          <div style={{ fontSize: '2.6rem' }}>{deaths.length === 0 ? '🌅' : '☀️'}</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, margin: '6px 0' }}>天亮了</h2>
          {deaths.length === 0 ? (
            <p style={{ color: 'var(--accent-emerald)', fontWeight: 800, fontSize: '1.1rem' }}>昨晚是平安夜，沒有人死亡</p>
          ) : (
            <>
              <p style={{ color: 'var(--fg-secondary)', margin: '0 0 8px' }}>昨晚死亡的是</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {deaths.map(id => {
                  const seat = view.seats.find(s => s.playerId === id);
                  return (
                    <span key={id} style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--accent-magenta)' }}>
                      💀 {nameOf(id)}{seat?.role ? <RoleBadge role={seat.role} /> : null}
                    </span>
                  );
                })}
              </div>
              {iDied && <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '10px' }}>你已出局，請保持安靜，可以按住看自己的身分</p>}
            </>
          )}
        </div>

        {renderLastWords(true)}

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy || lastWordsPending()} className="btn btn-primary btn-large btn-full">
              ▶️ 進入白天發言
            </button>
          ) : waitHost()}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 獵人 ─────────
  function renderHunter() {
    const h = view.hunter;
    if (!h) return null;
    const iAmHunter = h.hunterId === view.me.id;
    const targets = aliveSeats.filter(s => s.playerId !== view.me.id);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '22px 16px' }}>
          <div style={{ fontSize: '2.6rem' }}>🏹</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, margin: '6px 0' }}>獵人 {nameOf(h.hunterId)} 出局</h2>
          {h.resolved ? (
            <p style={{ color: 'var(--accent-magenta)', fontWeight: 800, fontSize: '1.1rem' }}>
              {h.targetId ? `開槍帶走了 ${nameOf(h.targetId)}！` : '放棄開槍'}
            </p>
          ) : iAmHunter ? (
            <p style={{ color: 'var(--fg-secondary)' }}>你可以開槍帶走一個人，或放棄</p>
          ) : (
            <p style={{ color: 'var(--fg-secondary)' }}>獵人正在決定要不要開槍…</p>
          )}
        </div>

        {iAmHunter && !h.resolved && (
          <>
            <PickList seats={targets} disabled={isBusy} onPick={id => press({ action: 'HUNTER_SHOT', targetId: id })} hint={() => '🎯 開槍'} />
            <NoneButton label="放棄開槍" disabled={isBusy} onClick={() => press({ action: 'HUNTER_SHOT', targetId: NONE })} />
          </>
        )}

        <div className="mt-auto flex-col gap-sm">
          {h.resolved
            ? (isHost ? (
              <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">▶️ 繼續</button>
            ) : waitHost())
            : hostBar(
              !iAmHunter && (
                <button onClick={() => press({ action: 'CONTINUE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
                  獵人沒反應，視為放棄
                </button>
              )
            )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 白天發言 ─────────
  function renderDay() {
    const speakerId = view.speakQueue[view.speakIndex];
    const isMyTurn = speakerId === view.me.id;
    return (
      <div className="view-container view-enter">
        {header}
        <div className={`card text-center shrink-0 mb-md ${isMyTurn ? 'card-hero-highlight' : ''}`} style={{ padding: '22px 16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>{isMyTurn ? '輪到你了！' : '正在發言'}</div>
          <h2 style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 900, margin: '6px 0' }}>{nameOf(speakerId)}</h2>
          {view.config.speechTime > 0 && (
            <SpeakTimer startedAt={view.speakStartedAt} seconds={view.config.speechTime} serverNow={serverNow} isMine={isMyTurn} />
          )}
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', margin: '8px 0 0' }}>
            {isMyTurn ? '說說你的看法與懷疑，好人要找出狼人，狼人要藏好' : '仔細聽，誰的話前後矛盾？'}
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

        {mySeat && !mySeat.isAlive && <DeadNotice />}
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

  // ───────── 投票 ─────────
  function renderBallots(ballots: WerewolfRoomView['ballots']) {
    return ballots.map(b => (
      <div key={b.attempt} className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>
          {b.attempt === 0 ? '投票結果（公開）' : '平票 PK 重投結果（公開）'}
        </div>
        {Object.entries(b.votes).map(([voter, target]) => (
          <div key={voter} className="flex-between" style={{ padding: '3px 0', color: '#ffffff', fontSize: '0.9rem' }}>
            <span>{nameOf(voter)}</span>
            <span style={{ color: target === NONE ? 'var(--fg-muted)' : 'var(--accent-magenta)' }}>
              {target === NONE ? '棄票' : `→ ${nameOf(target)}`}
            </span>
          </div>
        ))}
      </div>
    ));
  }

  function renderVote() {
    const canVote = !!mySeat?.isAlive;
    const votedCount = aliveSeats.filter(s => s.hasVoted).length;
    const candidates = view.seats.filter(s => view.candidates.includes(s.playerId) && s.playerId !== view.me.id);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="text-center shrink-0 mb-md">
          <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>
            {view.voteAttempt > 0 ? '⚖️ 平票！PK 重投' : '🗳️ 投票放逐'}
          </h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            {view.voteAttempt > 0
              ? `只能在 ${view.candidates.map(nameOf).join('、')} 之間選，再平票就沒人被放逐`
              : '全部人投完會自動開票，投完前都可以改票，也可以棄票'}
          </p>
          <div className="text-code text-cyan" style={{ marginTop: '8px', fontWeight: 800 }}>已投 {votedCount} / {aliveSeats.length}</div>
        </div>

        {renderBallots(view.ballots)}

        {canVote ? (
          <>
            <PickList
              seats={candidates}
              selectedId={view.myVote}
              disabled={isBusy}
              onPick={id => press({ action: 'VOTE', targetId: id })}
              hint={(s, sel) => (sel ? '🎯 已投他' : s.hasVoted ? '已投票' : '尚未投票')}
            />
            <NoneButton label="棄票" selected={view.myVote === NONE} disabled={isBusy} onClick={() => press({ action: 'VOTE', targetId: NONE })} />
          </>
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

  // ───────── 放逐 ─────────
  function renderExile() {
    const ex = view.lastExile;
    const outId = ex?.playerId ?? null;
    const outSeat = view.seats.find(s => s.playerId === outId);
    const tallyRows = Object.entries(ex?.tally || {}).sort((a, b) => b[1] - a[1]);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '24px 16px' }}>
          {outId ? (
            <>
              <div style={{ fontSize: '2.6rem' }}>{outId === view.me.id ? '💀' : '🚪'}</div>
              <h2 style={{ color: '#ffffff', fontSize: '1.8rem', fontWeight: 900, margin: '6px 0' }}>
                {outId === view.me.id ? '你被放逐了' : `${nameOf(outId)} 被放逐`}
              </h2>
              {outSeat?.role ? <RoleBadge role={outSeat.role} big /> : <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>身分保密，對局結束才公開</p>}
            </>
          ) : (
            <>
              <div style={{ fontSize: '2.6rem' }}>🤝</div>
              <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, margin: '6px 0' }}>
                {tallyRows.length === 0 ? '沒有人得票，本輪無人被放逐' : '再次平票，本輪無人被放逐'}
              </h2>
            </>
          )}
        </div>

        {renderLastWords(true)}

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
        {renderBallots(ex?.ballots || [])}

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy || lastWordsPending()} className="btn btn-primary btn-large btn-full">
              🌙 繼續（進入下一夜或判定勝負）
            </button>
          ) : waitHost()}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 終局 ─────────
  function renderResult() {
    const result = view.result;
    const myRole = mySeat?.role;
    const myTeam = myRole ? (myRole === 'WOLF' ? 'WOLF' : 'GOOD') : null;
    const iWon = !!myTeam && myTeam === view.winner;
    const winnerText = view.winner === 'WOLF' ? '🐺 狼人獲勝' : '🎉 好人獲勝';
    const rounds = result ? Array.from(new Set(result.events.map(e => `${e.round}-${e.step}`))) : [];
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '24px 16px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>{winnerText}</h1>
          <p style={{ color: 'var(--fg-secondary)', margin: '6px 0 12px' }}>{view.winReason}</p>
          {myTeam && <div style={{ fontWeight: 800, color: iWon ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>{iWon ? '🎉 你贏了！' : '😵 你輸了'}</div>}
        </div>

        {result && result.bestDetectives.length > 0 && (
          <div className="card text-center shrink-0 mb-md" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>🕵️ 最佳偵探（夜間推理命中狼人最多）</div>
            <div style={{ color: 'var(--accent-yellow)', fontWeight: 900, fontSize: '1.2rem', marginTop: '4px' }}>
              {result.bestDetectives.map(d => `${nameOf(d.playerId)}（${d.hits}/${d.total}）`).join('、')}
            </div>
          </div>
        )}

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>所有人的身分</div>
          {view.seats.map(s => (
            <div key={s.playerId} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', gap: '8px' }}>
              <div className="flex-col">
                <span style={{ color: s.isAlive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
                  {s.name}{s.playerId === view.me.id ? '（你）' : ''}{s.left ? '（已離開）' : ''}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{s.isAlive ? '存活到最後' : `第 ${s.deathRound} 輪出局`}</span>
              </div>
              {s.role && <RoleBadge role={s.role} />}
            </div>
          ))}
        </div>

        {result && (
          <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>📖 每晚發生的事</div>
            {rounds.map(key => {
              const [r, step] = key.split('-');
              const list: WerewolfEvent[] = result.events.filter(e => `${e.round}-${e.step}` === key);
              return (
                <div key={key} style={{ marginBottom: '8px' }}>
                  <div style={{ color: 'var(--accent-cyan-light)', fontWeight: 800, fontSize: '0.88rem' }}>
                    {step === 'NIGHT' ? `🌙 第 ${r} 夜` : `☀️ 第 ${r} 天`}
                  </div>
                  {list.map((e, i) => (
                    <div key={i} style={{ color: '#ffffff', fontSize: '0.85rem', padding: '2px 0' }}>{eventText(e, nameOf)}</div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <>
              <button onClick={() => press({ action: 'START' })} disabled={isBusy || view.players.length < 6} className="btn btn-primary btn-large btn-full">
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

const RevealPhase: React.FC<{
  header: React.ReactNode;
  role: import('@/types/werewolfRoom').WerewolfRole;
  mates: string[];
  ready: boolean;
  readyCount: number;
  total: number;
  waiting: string[];
  config: WerewolfRoomView['config'];
  onReady: () => void;
  hostBar: React.ReactNode;
  footer: React.ReactNode;
}> = ({ header, role, mates, ready, readyCount, total, waiting, config, onReady, hostBar, footer }) => {
  const [seen, setSeen] = useState(false);
  const setup = [
    `${config.wolfCount} 狼人`,
    ...(['seer', 'witch', 'hunter', 'guard'] as const).filter(k => config[k]).map(k => ROLE_INFO[({ seer: 'SEER', witch: 'WITCH', hunter: 'HUNTER', guard: 'GUARD' } as const)[k]].name)
  ].join('・');
  return (
    <div className="view-container view-enter">
      {header}
      <div className="scanner-card shrink-0 mb-md">
        <div className="badge badge-classified mb-sm">🔒 你的身分</div>
        <HoldToPeekRole
          role={role}
          onFirstReveal={() => setSeen(true)}
          extra={role === 'WOLF' && (
            <p style={{ color: 'var(--accent-magenta)', fontWeight: 800, margin: '6px 0 0' }}>
              {mates.length > 0 ? `狼隊友：${mates.join('、')}` : '你是唯一的狼人'}
            </p>
          )}
        />
        <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: '10px' }}>本局配置：{setup}・其餘平民</p>
      </div>

      <div className="shrink-0 mb-md">
        {ready ? (
          <div className="card text-center" style={{ padding: '14px' }}>
            <div style={{ color: '#ffffff', fontWeight: 800 }}>✅ 你已準備好（{readyCount}/{total}）</div>
            {waiting.length > 0 && (
              <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '6px' }}>還在確認：{waiting.join('、')}</div>
            )}
          </div>
        ) : (
          <button onClick={onReady} disabled={!seen} className="btn btn-primary btn-large btn-full">
            {seen ? '我記住了' : '先按住上方看身分'}
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
