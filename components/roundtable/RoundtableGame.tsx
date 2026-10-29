'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HostBar, WaitingText } from '@/components/avalon/online/AvalonParts';
import { NoneButton } from '@/components/werewolf/werewolfShared';
import { soundManager } from '@/lib/soundManager';
import { RT_NONE, RoundtableAction, RoundtableRoomView } from '@/types/roundtableRoom';
import { RoundtableFinalHunt, RoundtableNight } from './RoundtableNight';
import { RoundtableResult } from './RoundtableResult';
import { HoldToPeekRole, PickList, RtTopBar } from './roundtableShared';

interface RoundtableGameProps {
  view: RoundtableRoomView;
  isBusy: boolean;
  onAct: (action: RoundtableAction) => Promise<boolean>;
  onLeave: () => void;
}

export const RoundtableGame: React.FC<RoundtableGameProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const mySeat = view.mySeat;
  const meId = view.me.id;
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name
    || view.players.find(p => p.id === id)?.name || '—';
  const isLeader = view.leaderId === meId;
  const currentQuest = view.quests[view.questIndex];
  const teamNames = (ids: string[]) => ids.map(nameOf).join('、');
  const isNightPhase = view.phase === 'NIGHT' || view.phase === 'FINAL_HUNT';

  // 階段切換音效（夜晚與最後獵殺不播，避免旁人聽出動靜）
  const prevRef = useRef({ phase: view.phase });
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { phase: view.phase };
    if (prev.phase === view.phase) return;
    switch (view.phase) {
      case 'PROPOSE':
        if (view.leaderId === meId) soundManager.playTimerEnd();
        break;
      case 'TEAM_VOTE':
        soundManager.playHeartbeat();
        break;
      case 'QUEST':
        if (view.proposedTeam.includes(meId)) soundManager.playHeartbeat();
        break;
      case 'VOTE_RESULT':
        if (view.lastVote?.approved) soundManager.playVoteSuccess();
        else soundManager.playEliminate();
        break;
      case 'QUEST_RESULT':
        if (currentQuest?.status === 'SUCCESS') soundManager.playVoteSuccess();
        else soundManager.playEliminate();
        break;
      case 'DAWN':
        if (view.dawn?.deadId) soundManager.playEliminate();
        else soundManager.playRevealSecret();
        break;
      case 'RESULT':
        if (view.winner === 'GOOD') soundManager.playVictoryCivilian();
        else soundManager.playVictorySpy();
        break;
    }
  }, [view.phase, view.leaderId, view.lastVote, view.winner, view.proposedTeam, view.dawn, currentQuest, meId]);

  const press = (action: RoundtableAction) => {
    soundManager.playClick();
    onAct(action);
  };

  const header = <RtTopBar view={view} nameOf={nameOf} />;

  const footer = (
    <button onClick={onLeave} className="btn btn-ghost btn-full shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
      離開房間
    </button>
  );

  const canContinue = isHost || isLeader;

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
        background: isNightPhase
          ? 'linear-gradient(180deg, #010208 0%, #060a1c 100%)'
          : view.phase === 'DAWN' || view.phase === 'HUNTER'
            ? 'linear-gradient(180deg, #3b3552 0%, #141c2e 60%)'
            : 'linear-gradient(180deg, #2c3b5e 0%, #141c2e 55%)'
      }}
    >
      {content}
    </div>
  );

  function renderPhase(): React.ReactNode {
    // 旁觀者（對局中才加入）
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
      case 'REVEAL': return <RevealPhase view={view} header={header} footer={footer} press={press} nameOf={nameOf} />;
      case 'PROPOSE': return renderPropose();
      case 'TEAM_VOTE': return renderTeamVote();
      case 'VOTE_RESULT': return renderVoteResult();
      case 'QUEST': return renderQuest();
      case 'QUEST_RESULT': return renderQuestResult();
      case 'NIGHT':
        return view.night ? (
          <RoundtableNight
            view={view}
            isBusy={isBusy}
            onAct={onAct}
            header={header}
            footer={footer}
            hostBar={(
              <HostBar show={isHost}>
                <button onClick={() => onAct({ action: 'FORCE_RESOLVE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
                  強制結束夜晚（{view.night.progress.done}/{view.night.progress.total}，未行動視為放棄）
                </button>
              </HostBar>
            )}
          />
        ) : null;
      case 'DAWN': return renderDawn();
      case 'HUNTER': return renderHunter();
      case 'FINAL_HUNT':
        return view.hunt ? (
          <RoundtableFinalHunt
            view={view}
            isBusy={isBusy}
            onAct={onAct}
            header={header}
            footer={footer}
            hostBar={(
              <HostBar show={isHost}>
                <button onClick={() => onAct({ action: 'FORCE_RESOLVE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
                  不等了，以狼人多數強制鎖定
                </button>
              </HostBar>
            )}
          />
        ) : null;
      default:
        return <RoundtableResult view={view} header={header} footer={footer} isBusy={isBusy} press={press} nameOf={nameOf} />;
    }
  }

  // ───────── 組隊 ─────────
  function renderPropose() {
    return (
      <div className="view-container view-enter">
        {header}
        {isLeader ? (
          <ProposePhase view={view} isBusy={isBusy} onSubmit={team => press({ action: 'PROPOSE', team })} />
        ) : (
          <div className="card text-center shrink-0 mb-md" style={{ padding: '24px 16px' }}>
            <div style={{ fontSize: '2.2rem' }}>👑</div>
            <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900, margin: '6px 0' }}>{nameOf(view.leaderId)} 正在組隊</h2>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>
              要選 {currentQuest.requiredPlayers} 位存活的隊員出任務。大家可以先討論，說服隊長選你信任的人。
            </p>
            {mySeat && !mySeat.alive && <p style={{ color: '#fda4af', fontSize: '0.85rem', marginTop: '8px' }}>亡魂不能出任務，也請不要發言。</p>}
          </div>
        )}
        <div className="mt-auto">{footer}</div>
      </div>
    );
  }

  // ───────── 表決 ─────────
  function renderTeamVote() {
    const votedCount = view.seats.filter(s => s.hasVoted).length;
    const voterCount = view.seats.filter(s => !s.left).length;
    const dead = !!mySeat && !mySeat.alive;
    return (
      <div className="view-container view-enter">
        {header}
        <TeamCard title={`${nameOf(view.leaderId)} 提議的隊伍`} names={view.proposedTeam.map(nameOf)} meInTeam={view.proposedTeam.includes(meId)} />
        <div className="text-center shrink-0 mb-md">
          <h2 style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 900 }}>🗳️ 贊成這支隊伍嗎？</h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            {dead ? '你是亡魂，這是你的亡魂之票。' : '每個人秘密投票，包含陣亡的亡魂；'}全員投完自動開票，贊成要多於反對才通過
          </p>
          <div className="text-code text-cyan" style={{ marginTop: '6px', fontWeight: 800 }}>已投 {votedCount} / {voterCount}</div>
        </div>
        <div className="flex-col gap-sm shrink-0 mb-md">
          <VoteButton label="👍 贊成" selected={view.myVote === true} color="var(--accent-emerald)" disabled={isBusy} onClick={() => press({ action: 'VOTE', approve: true })} />
          <VoteButton label="👎 反對" selected={view.myVote === false} color="var(--accent-magenta)" disabled={isBusy} onClick={() => press({ action: 'VOTE', approve: false })} />
        </div>
        <div className="mt-auto flex-col gap-sm">
          <HostBar show={isHost}>
            <button onClick={() => press({ action: 'FORCE_RESOLVE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              不等了，強制開票（沒投的當贊成）{votedCount}/{voterCount}
            </button>
          </HostBar>
          {footer}
        </div>
      </div>
    );
  }

  function renderVoteResult() {
    const vote = view.lastVote!;
    const yes = Object.values(vote.votes).filter(Boolean).length;
    const no = Object.keys(vote.votes).length - yes;
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '2.4rem' }}>{vote.approved ? '✅' : '🚫'}</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.7rem', fontWeight: 900, margin: '6px 0' }}>
            {vote.approved ? '隊伍通過' : '隊伍被否決'}
          </h2>
          <div className="text-code" style={{ fontWeight: 800, color: 'var(--accent-cyan-light)' }}>贊成 {yes}　反對 {no}</div>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', margin: '8px 0 0' }}>隊伍：{teamNames(vote.team)}</p>
          {!vote.approved && !view.winner && (
            <p style={{ color: 'var(--accent-yellow)', fontSize: '0.85rem', margin: '6px 0 0' }}>
              連續否決 {vote.rejectCount}/5，隊長換下一位存活者{vote.rejectCount === 4 ? '（再否決一次狼人就贏了！）' : ''}
            </p>
          )}
          {view.winner && <p className="text-yellow" style={{ fontWeight: 800, marginTop: '10px' }}>{view.winReason}</p>}
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>每個人的票</div>
          {view.seats.filter(s => s.playerId in vote.votes).map(s => (
            <div key={s.playerId} className="flex-between" style={{ padding: '5px 0' }}>
              <span style={{ color: s.alive ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
                {s.name}{vote.team.includes(s.playerId) ? ' 🛡️' : ''}{s.alive ? '' : ' 👻'}
              </span>
              <span style={{ fontWeight: 800, color: vote.votes[s.playerId] ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>
                {vote.votes[s.playerId] ? '👍 贊成' : '👎 反對'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex-col gap-sm">
          {canContinue ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              {view.winner ? '🏁 公布結果' : vote.approved ? '⚔️ 出發執行任務' : '▶️ 換下一位隊長組隊'}
            </button>
          ) : (
            <WaitingText>⏳ 等待隊長或房主繼續…</WaitingText>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 出任務 ─────────
  function renderQuest() {
    const onTeam = view.proposedTeam.includes(meId);
    return (
      <div className="view-container view-enter">
        {header}
        <TeamCard title="出任務的隊伍" names={view.proposedTeam.map(nameOf)} meInTeam={onTeam} />
        {currentQuest.requiresTwoFails && (
          <p className="text-yellow text-center shrink-0 mb-md" style={{ fontSize: '0.85rem' }}>⚠️ 這一輪要 2 張失敗牌，任務才會失敗</p>
        )}
        {onTeam ? (
          view.myQuestCard ? (
            <div className="card text-center shrink-0 mb-md" style={{ padding: '18px' }}>
              <div style={{ color: '#ffffff', fontWeight: 800 }}>你已交出任務牌</div>
              <div className="text-code text-cyan" style={{ marginTop: '6px' }}>已交 {view.questSubmitted} / {view.proposedTeam.length}</div>
            </div>
          ) : (
            <QuestCardPicker isBusy={isBusy} onPick={success => press({ action: 'QUEST_CARD', success })} isGood={mySeat?.team === 'GOOD'} />
          )
        ) : (
          <div className="card text-center shrink-0 mb-md" style={{ padding: '20px' }}>
            <div style={{ color: 'var(--fg-secondary)' }}>⏳ 隊員正在秘密出牌…</div>
            <div className="text-code text-cyan" style={{ marginTop: '6px' }}>已交 {view.questSubmitted} / {view.proposedTeam.length}</div>
          </div>
        )}
        <div className="mt-auto flex-col gap-sm">
          <HostBar show={isHost}>
            <button onClick={() => press({ action: 'FORCE_RESOLVE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              不等了，強制結算（沒交的當成功）
            </button>
          </HostBar>
          {footer}
        </div>
      </div>
    );
  }

  function renderQuestResult() {
    const q = currentQuest;
    const ok = q.status === 'SUCCESS';
    const cards = [
      ...Array.from({ length: q.successCount ?? 0 }, () => '✅'),
      ...Array.from({ length: q.failCount ?? 0 }, () => '❌')
    ];
    const successTotal = view.quests.filter(x => x.status === 'SUCCESS').length;
    const next = view.winner
      ? null
      : successTotal >= 3
        ? '好人三勝！接下來是狼人的最後獵殺。'
        : ok
          ? '🗡️ 騎士凱旋，狼人今夜展開報復（天黑後狼人會殺人）'
          : '🛡️ 任務失敗，狼人今夜按兵不動（天黑後狼人不殺人）';
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '22px 16px' }}>
          <div style={{ fontSize: '2.6rem' }}>{ok ? '🏰' : '💥'}</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.8rem', fontWeight: 900, margin: '6px 0' }}>
            第 {q.round} 輪任務{ok ? '成功' : '失敗'}
          </h2>
          <div style={{ fontSize: '1.8rem', letterSpacing: '6px', margin: '8px 0' }}>{cards.join('')}</div>
          <div className="text-code" style={{ color: 'var(--accent-cyan-light)', fontWeight: 800 }}>成功 {q.successCount}　失敗 {q.failCount}</div>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.82rem', margin: '8px 0 0' }}>出任務的人：{teamNames(q.team)}（誰出了哪張牌不公開）</p>
          {next && <p style={{ color: ok ? '#fda4af' : '#93c5fd', fontSize: '0.88rem', fontWeight: 700, margin: '10px 0 0' }}>{next}</p>}
          {view.winner && <p className="text-yellow" style={{ fontWeight: 800, marginTop: '10px' }}>{view.winReason}</p>}
        </div>
        <div className="mt-auto flex-col gap-sm">
          {canContinue ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              {view.winner ? '🏁 公布結果' : successTotal >= 3 ? '🌑 進入最後獵殺' : '🌙 天黑請閉眼'}
            </button>
          ) : (
            <WaitingText>⏳ 等待隊長或房主繼續…</WaitingText>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 天亮 ─────────
  function renderDawn() {
    const dawn = view.dawn;
    const deadId = dawn?.deadId ?? null;
    const iDied = deadId === meId;
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '24px 16px' }}>
          <div style={{ fontSize: '2.6rem' }}>{deadId ? '☀️' : '🌅'}</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, margin: '6px 0' }}>天亮了</h2>
          {deadId ? (
            <>
              <p style={{ color: 'var(--fg-secondary)', margin: '0 0 8px' }}>昨晚死亡的是</p>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-magenta)' }}>💀 {nameOf(deadId)}</div>
              {iDied && <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '10px' }}>你已陣亡：仍可表決，但請不要發言。可以按住看自己的身分。</p>}
            </>
          ) : dawn?.kill ? (
            <p style={{ color: 'var(--accent-emerald)', fontWeight: 800, fontSize: '1.1rem' }}>昨晚是平安夜，沒有人死亡</p>
          ) : (
            <p style={{ color: '#93c5fd', fontWeight: 800, fontSize: '1.05rem' }}>昨晚狼人按兵不動，沒有人死亡</p>
          )}
        </div>
        <div className="mt-auto flex-col gap-sm">
          {isHost ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              ▶️ 繼續
            </button>
          ) : (
            <WaitingText>⏳ 等待房主繼續…</WaitingText>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // ───────── 獵人 ─────────
  function renderHunter() {
    const h = view.hunter;
    if (!h) return null;
    const iAmHunter = h.hunterId === meId;
    const targets = view.seats.filter(s => s.alive && s.playerId !== meId);
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '22px 16px' }}>
          <div style={{ fontSize: '2.6rem' }}>🏹</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.6rem', fontWeight: 900, margin: '6px 0' }}>獵人 {nameOf(h.hunterId)} 倒下了</h2>
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
            <NoneButton label="放棄開槍" disabled={isBusy} onClick={() => press({ action: 'HUNTER_SHOT', targetId: RT_NONE })} />
          </>
        )}

        <div className="mt-auto flex-col gap-sm">
          {h.resolved ? (
            isHost ? (
              <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">▶️ 繼續</button>
            ) : <WaitingText>⏳ 等待房主繼續…</WaitingText>
          ) : (
            <HostBar show={isHost && !iAmHunter}>
              <button onClick={() => press({ action: 'CONTINUE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
                獵人沒反應，視為放棄
              </button>
            </HostBar>
          )}
          {footer}
        </div>
      </div>
    );
  }
};

const TeamCard: React.FC<{ title: string; names: string[]; meInTeam: boolean }> = ({ title, names, meInTeam }) => (
  <div className="card shrink-0 mb-md" style={{ padding: '12px 14px', borderColor: meInTeam ? 'var(--accent-yellow)' : undefined }}>
    <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>{title}{meInTeam ? '（有你）' : ''}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {names.map(n => <span key={n} className="badge badge-cyan" style={{ padding: '5px 12px', fontSize: '0.9rem' }}>{n}</span>)}
    </div>
  </div>
);

const VoteButton: React.FC<{ label: string; selected: boolean; color: string; disabled: boolean; onClick: () => void }> = ({ label, selected, color, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="card"
    style={{
      padding: '22px',
      fontSize: '1.4rem',
      fontWeight: 900,
      color: '#ffffff',
      cursor: 'pointer',
      textAlign: 'center',
      borderColor: selected ? color : undefined,
      boxShadow: selected ? `0 0 14px ${color}` : undefined
    }}
  >
    {label}{selected ? '　✓' : ''}
  </button>
);

// 任務牌：兩顆按鈕外觀一模一樣（防偷看）。好人按失敗只會跳提示、不送出
const QuestCardPicker: React.FC<{ isBusy: boolean; isGood: boolean; onPick: (success: boolean) => void }> = ({ isBusy, isGood, onPick }) => {
  const [notice, setNotice] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleFail = () => {
    if (isGood) {
      setNotice(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setNotice(false), 2500);
      return;
    }
    onPick(false);
  };

  return (
    <div className="flex-col gap-sm shrink-0 mb-md">
      <p className="text-center" style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>秘密出牌，只會公開成功與失敗的張數</p>
      <button onClick={() => onPick(true)} disabled={isBusy} className="btn btn-primary btn-large btn-full" style={{ padding: '22px' }}>
        ✅ 任務成功
      </button>
      <button onClick={handleFail} disabled={isBusy} className="btn btn-danger btn-large btn-full" style={{ padding: '22px' }}>
        ❌ 任務失敗
      </button>
      <div style={{ minHeight: '22px' }}>
        {notice && <p className="text-center" style={{ color: 'var(--accent-yellow)', fontSize: '0.85rem', margin: 0 }}>好人只能出成功</p>}
      </div>
    </div>
  );
};

const RevealPhase: React.FC<{
  view: RoundtableRoomView;
  header: React.ReactNode;
  footer: React.ReactNode;
  press: (a: RoundtableAction) => void;
  nameOf: (id: string | null) => string;
}> = ({ view, header, footer, press, nameOf }) => {
  const [seen, setSeen] = useState(false);
  const seat = view.mySeat!;
  const present = view.seats.filter(s => !s.left);
  const readyCount = present.filter(s => s.ready).length;
  const waiting = present.filter(s => !s.ready);
  return (
    <div className="view-container view-enter">
      {header}
      <div className="scanner-card shrink-0 mb-md">
        <div className="badge badge-classified mb-sm">🔒 你的秘密身分</div>
        <HoldToPeekRole seat={seat} nameOf={nameOf} onFirstReveal={() => setSeen(true)} />
      </div>

      <div className="shrink-0 mb-md">
        {seat.ready ? (
          <div className="card text-center" style={{ padding: '14px' }}>
            <div style={{ color: '#ffffff', fontWeight: 800 }}>✅ 你已準備好（{readyCount}/{present.length}）</div>
            {waiting.length > 0 && (
              <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', marginTop: '6px' }}>還在看身分：{waiting.map(s => s.name).join('、')}</div>
            )}
          </div>
        ) : (
          <button onClick={() => press({ action: 'READY' })} disabled={!seen} className="btn btn-primary btn-large btn-full">
            {seen ? '我記住了' : '先按住上方看身分'}
          </button>
        )}
      </div>

      <div className="mt-auto flex-col gap-sm">
        <HostBar show={view.me.isHost}>
          <button onClick={() => press({ action: 'CONTINUE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
            不等了，直接開始第一輪
          </button>
        </HostBar>
        {footer}
      </div>
    </div>
  );
};

const ProposePhase: React.FC<{ view: RoundtableRoomView; isBusy: boolean; onSubmit: (team: string[]) => void }> = ({ view, isBusy, onSubmit }) => {
  const need = view.quests[view.questIndex].requiredPlayers;
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) => {
    soundManager.playClick();
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= need ? prev : [...prev, id]);
  };

  return (
    <>
      <div className="text-center shrink-0 mb-md">
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>👑 你是隊長，選 {need} 位隊員</h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
          可以選自己；陣亡的人不能出任務。點一下選取，再點一下取消
        </p>
        <div className="text-code text-cyan" style={{ marginTop: '6px', fontWeight: 800 }}>已選 {picked.length} / {need}</div>
      </div>
      <div className="flex-col gap-sm shrink-0 mb-md">
        {view.seats.filter(s => !s.left).map(s => {
          const on = picked.includes(s.playerId);
          const dead = !s.alive;
          return (
            <button
              key={s.playerId}
              onClick={() => toggle(s.playerId)}
              disabled={dead}
              className="card flex-between"
              style={{
                padding: '14px 16px',
                cursor: dead ? 'not-allowed' : 'pointer',
                opacity: dead ? 0.45 : 1,
                borderColor: on ? 'var(--accent-yellow)' : undefined,
                boxShadow: on ? '0 0 12px rgba(245, 158, 11, 0.35)' : undefined
              }}
            >
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>{s.name}{s.playerId === view.me.id ? '（你）' : ''}</span>
              <span style={{ fontSize: '0.85rem', color: on ? 'var(--accent-yellow)' : 'var(--fg-muted)' }}>{dead ? '💀 陣亡' : on ? '🛡️ 出任務' : '點選'}</span>
            </button>
          );
        })}
      </div>
      <button onClick={() => onSubmit(picked)} disabled={isBusy || picked.length !== need} className="btn btn-primary btn-large btn-full shrink-0">
        {picked.length === need ? '📣 送出隊伍，開始表決' : `還要再選 ${need - picked.length} 位`}
      </button>
    </>
  );
};
