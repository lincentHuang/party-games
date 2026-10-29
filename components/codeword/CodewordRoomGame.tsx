'use client';

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { CodewordAction, CodewordRoomView, CodewordTeam, ClueNumber } from '@/types/codewordRoom';
import { CARD_STYLE, ClueTimer, formatClueNumber, TEAM_INFO, TeamBadge } from './codewordShared';

interface CodewordRoomGameProps {
  view: CodewordRoomView;
  isBusy: boolean;
  onAct: (action: CodewordAction) => Promise<boolean>;
  onLeave: () => void;
  serverNow: () => number;
}

type ModalState = { kind: 'reveal'; index: number } | { kind: 'lobby' } | null;

const NUMBER_CHOICES: ClueNumber[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'INF'];

export const CodewordRoomGame: React.FC<CodewordRoomGameProps> = ({ view, isBusy, onAct, onLeave, serverNow }) => {
  const isHost = view.me.isHost;
  const isResult = view.phase === 'RESULT';
  const nameOf = (id: string | null | undefined) => view.members.find(m => m.playerId === id)?.name || '—';
  const captainOf = (t: CodewordTeam) => view.members.find(m => m.team === t && m.isCaptain);
  const turnInfo = TEAM_INFO[view.turn];

  const [clueWord, setClueWord] = useState('');
  const [clueNumber, setClueNumber] = useState<ClueNumber>(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [showHistory, setShowHistory] = useState(false);

  const amTurnCaptain = view.phase === 'CLUE' && view.myRole === 'CAPTAIN' && view.myTeam === view.turn;
  const canGuess = view.phase === 'GUESS' && view.myRole === 'GUESSER' && view.myTeam === view.turn;
  const myProposal = view.proposals[view.me.id];
  const guesserCount = view.members.filter(m => m.team === view.turn && !m.isCaptain).length;
  const needVotes = Math.floor(guesserCount / 2) + 1;

  // 音效：新翻開的牌、結束
  const prevRevealedRef = useRef(view.board.filter(c => c.revealed).length);
  const prevPhaseRef = useRef(view.phase);
  useEffect(() => {
    const revealed = view.board.filter(c => c.revealed).length;
    if (revealed > prevRevealedRef.current) {
      const last = view.history[view.history.length - 1]?.guesses.slice(-1)[0];
      if (last?.color === 'ASSASSIN') soundManager.playEliminate();
      else soundManager.playRevealSecret();
    }
    prevRevealedRef.current = revealed;
    if (prevPhaseRef.current !== view.phase) {
      prevPhaseRef.current = view.phase;
      if (view.phase === 'RESULT') {
        if (view.winner === 'RED') soundManager.playVictorySpy();
        else soundManager.playVictoryCivilian();
      }
    }
  }, [view.board, view.phase, view.winner, view.history]);

  // 每張牌上有誰提議
  const proposersOf = (index: number) =>
    Object.entries(view.proposals).filter(([, idx]) => idx === index).map(([pid]) => pid);

  const press = (action: CodewordAction) => {
    soundManager.playClick();
    return onAct(action);
  };

  const submitClue = async () => {
    const word = clueWord.trim();
    if (!word) return;
    const okay = await press({ action: 'GIVE_CLUE', word, number: clueNumber });
    if (okay) setClueWord('');
  };

  // ───────── 區塊 ─────────

  const header = (
    <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
      <div className="flex-col">
        <span className="badge badge-classified">{isResult ? '對局結束' : `第 ${view.round} 局`}</span>
        <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>{view.roomId}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['RED', 'BLUE'] as CodewordTeam[]).map(t => (
          <span key={t} style={{ fontWeight: 900, fontSize: '1.2rem', color: TEAM_INFO[t].color, textAlign: 'center' }}>
            {view.remaining[t]}
            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700 }}>{TEAM_INFO[t].name}剩餘</span>
          </span>
        ))}
      </div>
      <div className="flex-col" style={{ alignItems: 'flex-end', gap: '4px' }}>
        {view.myTeam ? <TeamBadge team={view.myTeam} suffix={view.myRole === 'CAPTAIN' ? '・隊長' : view.myRole === 'GUESSER' ? '・隊員' : ''} /> : <span className="badge">👀 旁觀者</span>}
      </div>
    </div>
  );

  const statusCard = () => {
    if (isResult && view.winner) {
      const w = TEAM_INFO[view.winner];
      return (
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '18px 16px', borderColor: w.color }}>
          <div style={{ fontSize: '2.2rem' }}>🏆</div>
          <h3 style={{ color: w.color, fontSize: '1.6rem', margin: '4px 0' }}>{w.emoji} {w.name}獲勝！</h3>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>{view.winReason}</p>
        </div>
      );
    }
    if (view.phase === 'CLUE') {
      const cap = captainOf(view.turn);
      return (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '14px 16px', borderColor: turnInfo.color }}>
          <TeamBadge team={view.turn} />
          <div style={{ color: '#ffffff', fontWeight: 800, margin: '8px 0 2px' }}>
            {amTurnCaptain ? '輪到你出題了！' : `等 👑 ${cap?.name || '隊長'} 出題…`}
          </div>
          {view.config.clueTime > 0 && (
            <ClueTimer startedAt={view.turnStartedAt} seconds={view.config.clueTime} serverNow={serverNow} isMine={amTurnCaptain} />
          )}
        </div>
      );
    }
    const clue = view.clue!;
    return (
      <div className="card text-center shrink-0 mb-md" style={{ padding: '14px 16px', borderColor: turnInfo.color }}>
        <TeamBadge team={view.turn} suffix="猜牌中" />
        <div style={{ margin: '8px 0 2px' }}>
          <span style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ffffff' }}>{clue.word}</span>
          <span style={{ fontSize: '1.7rem', fontWeight: 900, color: turnInfo.color, marginLeft: '10px' }}>{formatClueNumber(clue.number)}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
          已猜 {view.guessesUsed} 張・最多 {view.maxGuesses === null ? '不限' : `${view.maxGuesses} 張`}
          {guesserCount > 0 && `・需 ${needVotes} 位隊員同意才會翻開`}
        </div>
      </div>
    );
  };

  const clueForm = amTurnCaptain && (
    <div className="card shrink-0 mb-md" style={{ padding: '14px 16px' }}>
      <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>給隊員一個提示（一個詞＋數字）</div>
      <input
        className="input-text"
        value={clueWord}
        maxLength={12}
        placeholder="提示詞（不能是盤面上未翻開的詞）"
        onChange={e => setClueWord(e.target.value.replace(/\s/g, ''))}
        onKeyDown={e => { if (e.key === 'Enter') submitClue(); }}
      />
      <div style={{ fontSize: '0.78rem', color: 'var(--fg-secondary)', margin: '10px 0 6px' }}>數字＝這個提示對應幾張自己隊的牌（0 或 ∞ 猜牌不限次數）</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {NUMBER_CHOICES.map(n => (
          <button key={String(n)} onClick={() => setClueNumber(n)} className={`chip-btn ${clueNumber === n ? 'active' : ''}`} style={{ minWidth: '40px' }}>
            {formatClueNumber(n)}
          </button>
        ))}
      </div>
      <button onClick={submitClue} disabled={!clueWord.trim() || isBusy} className="btn btn-primary btn-large btn-full" style={{ marginTop: '12px' }}>
        送出提示「{clueWord.trim() || '…'}」{formatClueNumber(clueNumber)}
      </button>
    </div>
  );

  const board = (
    <div className="shrink-0 mb-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
      {view.board.map(c => {
        const proposers = proposersOf(c.index);
        const mineProposed = myProposal === c.index;
        const hasColor = c.color !== undefined;
        const style = c.color ? CARD_STYLE[c.color] : null;
        let background = 'var(--bg-elevated)';
        let borderColor = 'var(--border-card)';
        let color = '#ffffff';
        let opacity = 1;
        if (c.revealed && style) {
          background = style.bg; borderColor = style.border; color = style.text;
        } else if (hasColor && style) {
          // 隊長／結束後看到的答案地圖：用色框標示，未翻開的牌稍微變暗
          background = c.color === 'ASSASSIN' ? '#000000' : 'var(--bg-elevated)';
          borderColor = style.border;
          color = c.color === 'RED' ? '#fda4af' : c.color === 'BLUE' ? '#93c5fd' : c.color === 'NEUTRAL' ? '#d6d3d1' : '#ffffff';
          if (isResult) opacity = 0.7;
        }
        if (!c.revealed && mineProposed) borderColor = TEAM_INFO[view.turn].color;
        const clickable = canGuess && !c.revealed && !isBusy;
        return (
          <button
            key={c.index}
            onClick={() => clickable && press({ action: 'PROPOSE', index: c.index })}
            disabled={!clickable}
            style={{
              position: 'relative',
              minHeight: '62px',
              padding: '4px 2px 14px',
              borderRadius: '10px',
              border: `2px solid ${borderColor}`,
              background,
              color,
              opacity: c.revealed ? 0.92 : opacity,
              fontWeight: 800,
              fontSize: '0.88rem',
              lineHeight: 1.15,
              wordBreak: 'break-all',
              cursor: clickable ? 'pointer' : 'default',
              boxShadow: !c.revealed && mineProposed ? `0 0 12px ${TEAM_INFO[view.turn].color}` : undefined
            }}
          >
            {c.color === 'ASSASSIN' && <div style={{ fontSize: '0.8rem' }}>☠️</div>}
            {c.word}
            {c.revealed && c.revealedBy && c.color !== 'ASSASSIN' && <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{style?.label}</div>}
            {proposers.length > 0 && !c.revealed && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: '1px', display: 'flex', justifyContent: 'center', gap: '2px', flexWrap: 'wrap' }}>
                {proposers.map(pid => (
                  <span
                    key={pid}
                    title={nameOf(pid)}
                    style={{ fontSize: '0.6rem', lineHeight: '13px', minWidth: '13px', padding: '0 3px', borderRadius: '7px', background: TEAM_INFO[view.turn].color, color: '#ffffff', fontWeight: 900 }}
                  >
                    {Array.from(nameOf(pid).replace(/^🤖\s*/, ''))[0] || '?'}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const proposalList = view.phase === 'GUESS' && Object.keys(view.proposals).length > 0 && (
    <div className="shrink-0 mb-md" style={{ fontSize: '0.78rem', color: 'var(--fg-secondary)', textAlign: 'center' }}>
      {Object.entries(view.proposals).map(([pid, idx]) => `${nameOf(pid)} 提議「${view.board[idx]?.word}」`).join('・')}
    </div>
  );

  const guessControls = canGuess && (
    <div className="flex-col gap-sm shrink-0 mb-md">
      <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)', textAlign: 'center' }}>
        點一下牌＝提議翻開（再點一次收回）。同一張牌得到過半隊員同意就會翻開。
      </div>
      <button
        onClick={() => myProposal !== undefined && setModal({ kind: 'reveal', index: myProposal })}
        disabled={myProposal === undefined || isBusy}
        className="btn btn-secondary btn-full"
      >
        {myProposal === undefined ? '⚡ 直接翻開（先點一張牌）' : `⚡ 直接翻開「${view.board[myProposal]?.word}」`}
      </button>
      <button onClick={() => press({ action: 'END_GUESS' })} disabled={view.guessesUsed < 1 || isBusy} className="btn btn-ghost btn-full">
        ✋ 結束猜測{view.guessesUsed < 1 ? '（至少猜一張）' : ''}
      </button>
    </div>
  );

  const roleHint = !isResult && (
    <div className="shrink-0 mb-md text-center" style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
      {view.myRole === 'CAPTAIN' && '👑 你是隊長：看得到每張牌的顏色，只能出題，不能提議或翻牌，也別用表情暗示隊員'}
      {view.myRole === 'GUESSER' && !canGuess && view.phase === 'GUESS' && '輪到對方猜牌，你可以看他們怎麼猜'}
      {view.myRole === 'GUESSER' && view.phase === 'CLUE' && '隊長出題後才能猜牌'}
      {view.myRole === 'SPECTATOR' && '👀 你是旁觀者（隊員視角），下一局開始時會加入隊伍'}
    </div>
  );

  const history = view.history.length > 0 && (
    <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
      <button onClick={() => setShowHistory(v => !v)} className="btn-ghost btn-full flex-between" style={{ color: '#ffffff', fontWeight: 800 }}>
        <span>📜 提示紀錄（{view.history.length}）</span>
        <span>{showHistory || isResult ? '▲' : '▼'}</span>
      </button>
      {(showHistory || isResult) && (
        <div className="flex-col gap-sm" style={{ marginTop: '8px' }}>
          {view.history.map((h, i) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: 'var(--radius-inner)', background: 'var(--bg-elevated)', borderLeft: `4px solid ${TEAM_INFO[h.team].color}` }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '0.9rem' }}>
                {TEAM_INFO[h.team].emoji} {h.word} <span style={{ color: TEAM_INFO[h.team].color }}>{formatClueNumber(h.number)}</span>
                <span style={{ fontWeight: 400, color: 'var(--fg-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>by {nameOf(h.captainId)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {h.guesses.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>（沒有猜牌）</span>}
                {h.guesses.map((g, gi) => (
                  <span key={gi} style={{ fontSize: '0.75rem', padding: '1px 8px', borderRadius: '8px', background: CARD_STYLE[g.color].bg, border: `1px solid ${CARD_STYLE[g.color].border}`, color: '#ffffff' }}>
                    {g.word}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const hostBar = isHost && (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 12px', borderStyle: 'dashed' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>👑 房主控制</div>
      {isResult ? (
        <div className="flex-col gap-sm">
          <button onClick={() => press({ action: 'NEXT_ROUND', rotateCaptains: false })} disabled={isBusy} className="btn btn-primary btn-large btn-full">🔄 再來一局（隊伍・隊長不變）</button>
          <button onClick={() => press({ action: 'NEXT_ROUND', rotateCaptains: true })} disabled={isBusy} className="btn btn-secondary btn-full">👑 再來一局（隊長換人）</button>
          <button onClick={() => press({ action: 'BACK_TO_LOBBY' })} disabled={isBusy} className="btn btn-ghost btn-full" style={{ fontSize: '0.85rem' }}>回大廳重新分隊</button>
        </div>
      ) : (
        <button onClick={() => setModal({ kind: 'lobby' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>中止這局，回大廳</button>
      )}
    </div>
  );

  const waitHost = isResult && !isHost && (
    <div className="text-center shrink-0" style={{ color: 'var(--fg-secondary)', padding: '10px 0' }}>⏳ 等待房主開下一局…</div>
  );

  const confirmModal = modal && (
    <div className="modal-overlay" onClick={() => setModal(null)}>
      <div className="modal-sheet text-center" style={{ maxWidth: '400px', padding: '20px' }} onClick={e => e.stopPropagation()}>
        {modal.kind === 'reveal' ? (
          <>
            <h3 style={{ color: '#ffffff', fontWeight: 900, marginBottom: '10px' }}>直接翻開「{view.board[modal.index]?.word}」？</h3>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>不用等其他隊員同意，翻開後無法反悔。翻到刺客整隊就輸了。</p>
            <div className="flex-col gap-sm">
              <button
                onClick={() => { const idx = modal.index; setModal(null); press({ action: 'REVEAL', index: idx }); }}
                className="btn btn-danger btn-large btn-full"
              >
                確定翻開
              </button>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-full">再想想</button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ color: '#ffffff', fontWeight: 900, marginBottom: '10px' }}>中止這局？</h3>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>盤面會作廢，大家回到大廳（保留分隊）。</p>
            <div className="flex-col gap-sm">
              <button onClick={() => { setModal(null); press({ action: 'BACK_TO_LOBBY' }); }} className="btn btn-danger btn-large btn-full">回大廳</button>
              <button onClick={() => setModal(null)} className="btn btn-ghost btn-full">繼續玩</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="view-container view-enter">
      {header}
      {statusCard()}
      {clueForm}
      {board}
      {proposalList}
      {guessControls}
      {roleHint}
      {history}
      {hostBar}
      {waitHost}
      <button onClick={onLeave} className="btn btn-ghost btn-full shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
        離開房間
      </button>
      {confirmModal}
    </div>
  );
};
