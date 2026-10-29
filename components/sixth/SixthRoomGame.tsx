'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { rowBombs, SIXTH_HAND_SIZE, SixthAction, SixthRoomView } from '@/types/sixthRoom';
import { BombMark, placementText, SixthBoard, SixthCard, useRoundReplay } from './sixthShared';

interface SixthRoomGameProps {
  view: SixthRoomView;
  isBusy: boolean;
  onAct: (action: SixthAction) => Promise<boolean>;
  onLeave: () => void;
}

const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`);

export const SixthRoomGame: React.FC<SixthRoomGameProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const my = view.mySeat;
  const nameOf = (id: string) => view.seats.find(s => s.playerId === id)?.name ?? '—';
  const activeSeats = view.seats.filter(s => !s.left);
  const replay = useRoundReplay(view);
  const [selected, setSelected] = useState<number | null>(null);
  const [rowSel, setRowSel] = useState<number | null>(null);

  // 換輪（手牌張數變了）或換手時清掉選擇
  const handKey = `${view.hand}-${my?.hand.length ?? 0}`;
  useEffect(() => { setSelected(null); setRowSel(null); }, [handKey]);

  // 揭曉時逐張播音效：吃到炸彈用爆炸聲
  const prevShownRef = useRef(replay.shownCount);
  useEffect(() => {
    if (replay.shownCount > prevShownRef.current) {
      const ev = replay.shownEvents[replay.shownCount - 1];
      if (ev) ev.bombs > 0 ? soundManager.playEliminate() : soundManager.playClick();
    }
    prevShownRef.current = replay.shownCount;
  }, [replay.shownCount, replay.shownEvents]);

  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    if (prevPhaseRef.current === view.phase) return;
    prevPhaseRef.current = view.phase;
    if (view.phase === 'RESULT') soundManager.playVictoryCivilian();
  }, [view.phase]);

  const press = (action: SixthAction) => {
    soundManager.playClick();
    onAct(action);
  };

  const pendingTake = view.pendingTake;
  const iAmTaker = !!pendingTake && pendingTake.playerId === view.me.id;
  // 揭曉動畫播完之後，要吃牌的人才能選列（先讓大家看清楚桌面）
  const canPickRow = iAmTaker && !replay.animating;
  const waiting = activeSeats.filter(s => !s.submitted);

  const header = (
    <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
      <div className="flex-col">
        <span className="badge badge-classified">
          {view.phase === 'RESULT' ? '整場結束' : `💥 第 ${view.hand} 手・第 ${view.round}/${SIXTH_HAND_SIZE} 輪`}
        </span>
        <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>
          {view.roomId}{view.config.expert ? ' · 專家模式' : ''}
        </span>
      </div>
      <span className="badge badge-cyan">上限 💣 {view.config.limit}</span>
    </div>
  );

  const scoreStrip = (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: '6px' }}>
        {view.seats.map(s => {
          const danger = s.score >= view.config.limit * 0.8;
          const isMe = s.playerId === view.me.id;
          const isTaker = pendingTake?.playerId === s.playerId;
          return (
            <div
              key={s.playerId}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--radius-inner)',
                background: 'var(--bg-elevated)',
                border: `1px solid ${isMe ? 'var(--accent-cyan-light)' : isTaker ? 'var(--accent-magenta)' : 'transparent'}`,
                opacity: s.left ? 0.4 : 1,
                minWidth: 0
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}{s.left ? '（已離開）' : ''}
              </div>
              <div className="flex-between" style={{ marginTop: '2px' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: danger ? 'var(--accent-magenta)' : 'var(--accent-yellow)' }}>💣 {s.score}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                  {s.left ? '' : view.phase === 'PICK'
                    ? (s.submitted ? '✅ 已出牌' : '⏳ 選牌中')
                    : isTaker ? '🙋 選列' : `+${s.handBombs}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const lastEvent = replay.shownEvents[replay.shownEvents.length - 1];
  const banner = replay.log && lastEvent ? (
    <div
      className="shrink-0 mb-md text-center"
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius-inner)',
        fontSize: '0.88rem',
        fontWeight: 700,
        background: lastEvent.bombs > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(6, 182, 212, 0.12)',
        color: lastEvent.bombs > 0 ? '#fda4af' : 'var(--accent-cyan-light)'
      }}
    >
      {placementText(lastEvent, nameOf)}
    </div>
  ) : null;

  const logCard = replay.log && replay.shownEvents.length > 0 ? (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>
        第 {replay.log.round} 輪揭曉{replay.animating ? '中…' : ''}
      </div>
      <div className="flex-col" style={{ gap: '4px' }}>
        {replay.shownEvents.map((ev, i) => (
          <div key={i} style={{ fontSize: '0.8rem', color: ev.bombs > 0 ? '#fda4af' : 'var(--fg-secondary)' }}>
            {i + 1}. {placementText(ev, nameOf)}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const footer = (
    <button onClick={onLeave} className="btn btn-ghost btn-full shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
      離開房間
    </button>
  );

  const hostBar = (children: React.ReactNode) => isHost && (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 12px', borderStyle: 'dashed' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>👑 房主控制</div>
      {children}
    </div>
  );

  // ───────── 各階段下半部 ─────────

  const renderBottom = (): React.ReactNode => {
    if (view.phase === 'RESULT') return renderResult();
    if (view.phase === 'HAND_END') return replay.animating ? waitingCard('揭曉最後一輪中…') : renderHandEnd();

    if (view.phase === 'PICK_ROW' && pendingTake) {
      const takerName = nameOf(pendingTake.playerId);
      return (
        <>
          <div className="card shrink-0 mb-md text-center" style={{ padding: '14px', borderColor: 'var(--accent-magenta)' }}>
            {replay.animating ? (
              <div style={{ color: 'var(--fg-secondary)' }}>揭曉中…</div>
            ) : iAmTaker ? (
              <>
                <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  你的 {pendingTake.card} 比所有列都小，點上方一列整列吃掉
                </div>
                {rowSel !== null ? (
                  <button onClick={() => press({ action: 'PICK_ROW', row: rowSel })} disabled={isBusy} className="btn btn-danger btn-large btn-full">
                    吃掉第 {rowSel + 1} 列（💣×{rowBombs(view.rows[rowSel])}）
                  </button>
                ) : (
                  <div style={{ color: 'var(--accent-yellow)', fontSize: '0.88rem' }}>👆 還沒選列</div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--fg-secondary)' }}>
                ⏳ 等 <b style={{ color: '#ffffff' }}>{takerName}</b> 為 {pendingTake.card} 選一列吃掉…
              </div>
            )}
          </div>
          {!iAmTaker && !replay.animating && hostBar(
            <button onClick={() => press({ action: 'FORCE_ROW' })} disabled={isBusy} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              他沒反應？代選炸彈最少的列
            </button>
          )}
          {my && renderHand(true)}
        </>
      );
    }

    if (!my) {
      return (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '18px 16px' }}>
          <div style={{ fontSize: '2rem' }}>👀</div>
          <div style={{ color: '#ffffff', fontWeight: 800, margin: '6px 0' }}>你是旁觀者</div>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', margin: 0 }}>這場已經開始，等房主回大廳再開新的一場就能加入。</p>
        </div>
      );
    }
    return renderHand(false);
  };

  const waitingCard = (text: string) => (
    <div className="card shrink-0 mb-md text-center" style={{ padding: '14px', color: 'var(--fg-secondary)' }}>{text}</div>
  );

  // 自己的手牌：5 張一排、共兩排
  const renderHand = (readOnly: boolean): React.ReactNode => {
    if (!my) return null;
    const submitted = my.pick;
    const locked = readOnly || replay.animating;
    let label: string;
    if (replay.animating) label = '揭曉中…';
    else if (selected === null) label = submitted !== null ? `✅ 已送出 ${submitted}，點其他牌可改選` : '先點一張牌';
    else if (submitted === selected) label = `✅ 已送出 ${selected}`;
    else label = submitted !== null ? `改出 ${selected}` : `出牌 ${selected}`;

    return (
      <>
        <div className="shrink-0 mb-sm" style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
          你的手牌（{my.hand.length} 張）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px 6px', paddingTop: '8px' }} className="shrink-0 mb-md">
          {my.hand.map(c => (
            <SixthCard
              key={c}
              card={c}
              size="hand"
              selected={!readOnly && selected === c}
              picked={submitted === c && selected !== c}
              disabled={readOnly}
              onClick={readOnly ? undefined : () => { soundManager.playClick(); setSelected(c); }}
            />
          ))}
        </div>
        {!readOnly && (
          <>
            <button
              onClick={() => selected !== null && press({ action: 'PICK', card: selected })}
              disabled={locked || selected === null || submitted === selected || isBusy}
              className="btn btn-primary btn-large btn-full shrink-0"
            >
              {label}
            </button>
            {!replay.animating && waiting.length > 0 && submitted !== null && (
              <p className="text-center shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                還在等：{waiting.map(s => s.name).join('、')}
              </p>
            )}
            {!replay.animating && hostBar(
              <button onClick={() => press({ action: 'FORCE_PICK' })} disabled={isBusy || waiting.length === 0} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
                有人卡住？系統代出牌並揭曉
              </button>
            )}
          </>
        )}
        {readOnly && !replay.animating && !iAmTaker && (
          <p className="text-center shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>等這張處理完，大家再繼續選牌</p>
        )}
      </>
    );
  };

  const renderHandEnd = () => {
    const rank = [...activeSeats].sort((a, b) => a.handBombs - b.handBombs);
    return (
      <>
        <div className="card shrink-0 mb-md" style={{ padding: '14px 16px' }}>
          <h3 style={{ color: '#ffffff', fontWeight: 900, textAlign: 'center', marginBottom: '10px' }}>第 {view.hand} 手結算</h3>
          <div className="flex-col gap-sm">
            {rank.map(s => (
              <div key={s.playerId} className="flex-between" style={{ padding: '8px 10px', borderRadius: 'var(--radius-inner)', background: 'var(--bg-elevated)' }}>
                <span style={{ fontWeight: 700, color: s.playerId === view.me.id ? 'var(--accent-cyan-light)' : '#ffffff' }}>{s.name}</span>
                <span style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--fg-muted)' }}>本手 </span>
                  <b style={{ color: 'var(--accent-magenta)' }}>+{s.handBombs}</b>
                  <span style={{ color: 'var(--fg-muted)' }}>　累計 </span>
                  <b style={{ color: 'var(--accent-yellow)' }}>{s.score}</b>
                  <span style={{ color: 'var(--fg-muted)' }}> / {view.config.limit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <button onClick={() => press({ action: 'NEXT_HAND' })} disabled={isBusy} className="btn btn-primary btn-large btn-full shrink-0">
            ▶️ 下一手
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>⏳ 等待房主開始下一手…</div>
        )}
      </>
    );
  };

  const renderResult = () => {
    const rank = [...view.seats].sort((a, b) => (a.left ? 1 : 0) - (b.left ? 1 : 0) || a.score - b.score);
    // 同分同名次
    const places: number[] = [];
    rank.forEach((s, i) => places.push(i > 0 && s.score === rank[i - 1].score && !!s.left === !!rank[i - 1].left ? places[i - 1] : i));
    const iWon = view.winnerIds.includes(view.me.id);
    return (
      <>
        <div className="card shrink-0 mb-md" style={{ padding: '16px' }}>
          <div className="text-center" style={{ fontSize: '2rem' }}>{iWon ? '🏆' : '💥'}</div>
          <h3 style={{ color: '#ffffff', fontWeight: 900, textAlign: 'center', margin: '4px 0 12px' }}>
            {view.winnerIds.length > 0 ? `${view.winnerIds.map(nameOf).join('、')} 獲勝！` : '遊戲結束'}
          </h3>
          <div className="flex-col gap-sm">
            {rank.map((s, i) => (
              <div key={s.playerId} className="flex-between" style={{ padding: '8px 10px', borderRadius: 'var(--radius-inner)', background: view.winnerIds.includes(s.playerId) ? 'rgba(16, 185, 129, 0.18)' : 'var(--bg-elevated)', opacity: s.left ? 0.5 : 1 }}>
                <span style={{ fontWeight: 700, color: s.playerId === view.me.id ? 'var(--accent-cyan-light)' : '#ffffff' }}>
                  {s.left ? '—' : medal(places[i])} {s.name}{s.left ? '（中途離開）' : ''}
                </span>
                <b style={{ color: 'var(--accent-yellow)' }}>💣 {s.score}</b>
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <button onClick={() => press({ action: 'BACK_TO_LOBBY' })} disabled={isBusy} className="btn btn-primary btn-large btn-full shrink-0">
            🔁 再來一場
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>⏳ 等待房主再開一場…</div>
        )}
      </>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'linear-gradient(180deg, #1c2540 0%, #0e1424 60%)' }}>
      <div className="view-container view-enter">
        {header}
        <SixthBoard
          rows={replay.rows}
          highlight={replay.highlight}
          clickable={canPickRow}
          selectedRow={canPickRow ? rowSel : null}
          onRowClick={r => { soundManager.playClick(); setRowSel(r); }}
        />
        {banner}
        {scoreStrip}
        {renderBottom()}
        {logCard}
        {footer}
      </div>
    </div>
  );
};

