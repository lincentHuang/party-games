'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ROLE_INFO } from '@/lib/avalonRules';
import { soundManager } from '@/lib/soundManager';
import { AvalonAction, AvalonRoomView } from '@/types/avalonRoom';
import { HoldToPeekRole, HostBar, QuestTrack, WaitingText } from './AvalonParts';

interface AvalonRoomGameProps {
  view: AvalonRoomView;
  isBusy: boolean;
  onAct: (action: AvalonAction) => Promise<boolean>;
  onLeave: () => void;
}

export const AvalonRoomGame: React.FC<AvalonRoomGameProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const mySeat = view.mySeat;
  const meId = view.me.id;
  const nameOf = (id: string | null) => view.seats.find(s => s.playerId === id)?.name
    || view.players.find(p => p.id === id)?.name || '—';
  const isLeader = view.leaderId === meId;
  const currentQuest = view.quests[view.questIndex];

  // 狀態轉換時的音效
  const prevRef = useRef({ phase: view.phase, leader: view.leaderId });
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { phase: view.phase, leader: view.leaderId };
    if (prev.phase === view.phase) return;
    switch (view.phase) {
      case 'PROPOSE':
      case 'LADY':
        if (view.phase === 'PROPOSE' ? isLeader : view.lady.holderId === meId) soundManager.playTimerEnd();
        break;
      case 'TEAM_VOTE':
      case 'ASSASSINATE':
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
      case 'RESULT':
        if (view.winner === 'GOOD') soundManager.playVictoryCivilian();
        else soundManager.playVictorySpy();
        break;
    }
  }, [view.phase, view.leaderId, view.lastVote, view.winner, view.proposedTeam, view.lady.holderId, currentQuest, isLeader, meId]);

  const press = (action: AvalonAction) => {
    soundManager.playClick();
    onAct(action);
  };

  const header = (
    <>
      <div className="flex-between mb-md shrink-0" style={{ gap: '8px' }}>
        <div className="flex-col">
          <span className="badge badge-classified">
            {view.phase === 'RESULT' ? '對局結束' : view.phase === 'REVEAL' ? '確認身分中' : `第 ${view.questIndex + 1} 輪任務`}
          </span>
          <span className="text-code" style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: '4px' }}>{view.roomId}</span>
        </div>
        {mySeat && view.phase !== 'REVEAL' && view.phase !== 'RESULT' && <HoldToPeekRole seat={mySeat} compact />}
      </div>
      {view.phase !== 'REVEAL' && <QuestTrack view={view} nameOf={nameOf} />}
    </>
  );

  const footer = (
    <button onClick={onLeave} className="btn btn-ghost btn-full shrink-0" style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
      離開房間
    </button>
  );

  const canContinue = isHost || isLeader;
  const teamNames = (ids: string[]) => ids.map(nameOf).join('、');

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

  // 1. 確認身分
  if (view.phase === 'REVEAL') {
    return <RevealPhase view={view} header={header} footer={footer} press={press} />;
  }

  // 2. 隊長組隊
  if (view.phase === 'PROPOSE') {
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
              要選 {currentQuest.requiredPlayers} 位隊員出任務。大家可以先討論，說服隊長選你信任的人。
            </p>
          </div>
        )}
        <div className="mt-auto">{footer}</div>
      </div>
    );
  }

  // 3. 全員表決
  if (view.phase === 'TEAM_VOTE') {
    const votedCount = view.seats.filter(s => s.hasVoted).length;
    return (
      <div className="view-container view-enter">
        {header}
        <TeamCard title={`${nameOf(view.leaderId)} 提議的隊伍`} names={view.proposedTeam.map(nameOf)} meInTeam={view.proposedTeam.includes(meId)} />
        <div className="text-center shrink-0 mb-md">
          <h2 style={{ color: '#ffffff', fontSize: '1.4rem', fontWeight: 900 }}>🗳️ 贊成這支隊伍嗎？</h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            每個人秘密投票，全員投完自動開票，投完前都可以改票
          </p>
          <div className="text-code text-cyan" style={{ marginTop: '6px', fontWeight: 800 }}>已投 {votedCount} / {view.seats.length}</div>
        </div>
        <div className="flex-col gap-sm shrink-0 mb-md">
          <VoteButton label="👍 贊成" selected={view.myVote === true} color="var(--accent-emerald)" disabled={isBusy} onClick={() => press({ action: 'VOTE', approve: true })} />
          <VoteButton label="👎 反對" selected={view.myVote === false} color="var(--accent-magenta)" disabled={isBusy} onClick={() => press({ action: 'VOTE', approve: false })} />
        </div>
        <div className="mt-auto flex-col gap-sm">
          <HostBar show={isHost}>
            <button onClick={() => press({ action: 'FORCE_RESOLVE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              不等了，強制開票（沒投的當贊成）{votedCount}/{view.seats.length}
            </button>
          </HostBar>
          {footer}
        </div>
      </div>
    );
  }

  // 4. 公開表決結果
  if (view.phase === 'VOTE_RESULT') {
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
              連續否決 {vote.rejectCount}/5，隊長換下一位{vote.rejectCount === 4 ? '（再否決一次壞人就贏了！）' : ''}
            </p>
          )}
          {view.winner && <p className="text-yellow" style={{ fontWeight: 800, marginTop: '10px' }}>{view.winReason}</p>}
        </div>

        <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>每個人的票</div>
          {view.seats.map(s => (
            <div key={s.playerId} className="flex-between" style={{ padding: '5px 0' }}>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{s.name}{vote.team.includes(s.playerId) ? ' 🛡️' : ''}</span>
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

  // 5. 出任務
  if (view.phase === 'QUEST') {
    const onTeam = view.proposedTeam.includes(meId);
    const isGood = mySeat?.alignment === 'GOOD';
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
              <div style={{ color: '#ffffff', fontWeight: 800 }}>
                你已交出 {view.myQuestCard === 'SUCCESS' ? '✅ 成功' : '❌ 失敗'} 牌
              </div>
              <div className="text-code text-cyan" style={{ marginTop: '6px' }}>已交 {view.questSubmitted} / {view.proposedTeam.length}</div>
            </div>
          ) : (
            <QuestCardPicker isBusy={isBusy} isGood={isGood} onPick={success => press({ action: 'QUEST_CARD', success })} />
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

  // 6. 任務結果
  if (view.phase === 'QUEST_RESULT') {
    const q = currentQuest;
    const ok = q.status === 'SUCCESS';
    const cards = [
      ...Array.from({ length: q.successCount ?? 0 }, () => '✅'),
      ...Array.from({ length: q.failCount ?? 0 }, () => '❌')
    ];
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
          {view.winner && <p className="text-yellow" style={{ fontWeight: 800, marginTop: '10px' }}>{view.winReason}</p>}
        </div>
        <div className="mt-auto flex-col gap-sm">
          {canContinue ? (
            <button onClick={() => press({ action: 'CONTINUE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              {view.winner ? '🏁 公布結果' : view.quests.filter(x => x.status === 'SUCCESS').length >= 3 ? '🗡️ 進入刺殺階段' : '▶️ 繼續'}
            </button>
          ) : (
            <WaitingText>⏳ 等待隊長或房主繼續…</WaitingText>
          )}
          {footer}
        </div>
      </div>
    );
  }

  // 7. 湖中仙女
  if (view.phase === 'LADY') {
    const isHolder = view.lady.holderId === meId;
    const lastResult = view.lady.myResults[view.lady.myResults.length - 1];
    return (
      <div className="view-container view-enter">
        {header}
        <div className="card text-center shrink-0 mb-md" style={{ padding: '18px 16px' }}>
          <div style={{ fontSize: '2.2rem' }}>🧜‍♀️</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900, margin: '6px 0' }}>湖中仙女</h2>
          <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>
            {isHolder ? '選一位玩家，秘密查驗他是好人還是壞人，之後仙女會交給他。' : `${nameOf(view.lady.holderId)} 正在使用湖中仙女查驗一位玩家…`}
          </p>
        </div>

        {isHolder && !view.lady.checkedThisRound && (
          <div className="flex-col gap-sm shrink-0 mb-md">
            {view.lady.candidates.map(id => (
              <button key={id} onClick={() => press({ action: 'LADY_CHECK', targetId: id })} disabled={isBusy} className="card flex-between" style={{ padding: '14px 16px', cursor: 'pointer' }}>
                <span style={{ color: '#ffffff', fontWeight: 800 }}>{nameOf(id)}</span>
                <span style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>查驗他</span>
              </button>
            ))}
          </div>
        )}

        {isHolder && view.lady.checkedThisRound && lastResult && (
          <div className={`card text-center shrink-0 mb-md ${lastResult.alignment === 'GOOD' ? 'avalon-good' : 'avalon-evil'}`} style={{ padding: '20px' }}>
            <div style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>{nameOf(lastResult.targetId)} 是</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{lastResult.alignment === 'GOOD' ? '⚔️ 好人' : '🗡️ 壞人'}</div>
            <p style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', marginTop: '6px' }}>只有你看得到這個結果，要不要說實話隨你</p>
          </div>
        )}

        <div className="mt-auto flex-col gap-sm">
          {isHolder && view.lady.checkedThisRound && (
            <button onClick={() => press({ action: 'LADY_DONE' })} disabled={isBusy} className="btn btn-primary btn-large btn-full">
              我看完了，把仙女交給 {nameOf(lastResult?.targetId ?? null)}
            </button>
          )}
          {!isHolder && <WaitingText>⏳ 等待仙女持有者…</WaitingText>}
          <HostBar show={isHost && !isHolder}>
            <button onClick={() => press({ action: 'LADY_DONE' })} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem' }}>
              {view.lady.checkedThisRound ? '繼續下一輪' : '持有者沒反應，略過這次查驗'}
            </button>
          </HostBar>
          {footer}
        </div>
      </div>
    );
  }

  // 8. 刺殺梅林
  if (view.phase === 'ASSASSINATE') {
    return <AssassinatePhase view={view} header={header} footer={footer} isBusy={isBusy} press={press} />;
  }

  // 9. 終局
  const winnerText = view.winner === 'GOOD' ? '⚔️ 正義陣營獲勝' : '🗡️ 邪惡陣營獲勝';
  const iWon = !!mySeat && mySeat.alignment === view.winner;
  return (
    <div className="view-container view-enter">
      {header}
      <div className="card text-center shrink-0 mb-md card-hero-highlight" style={{ padding: '24px 16px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>{winnerText}</h1>
        <p style={{ color: 'var(--fg-secondary)', margin: '6px 0 12px' }}>{view.winReason}</p>
        {mySeat && <div style={{ fontWeight: 800, color: iWon ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>{iWon ? '🎉 你贏了！' : '😵 你輸了'}</div>}
      </div>

      <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>所有人的角色</div>
        {view.seats.map(s => {
          const info = s.role ? ROLE_INFO[s.role] : null;
          return (
            <div key={s.playerId} className="flex-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', gap: '8px' }}>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>
                {s.name}{s.playerId === meId ? '（你）' : ''}
                {view.assassinTargetId === s.playerId && ' 🎯'}
              </span>
              {info && <span className={`badge ${info.alignment === 'GOOD' ? 'badge-cyan' : 'badge-role-spy'}`}>{info.icon} {info.name}</span>}
            </div>
          );
        })}
      </div>

      <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '4px' }}>任務紀錄</div>
        {view.quests.filter(q => q.status !== 'PENDING').map(q => (
          <div key={q.round} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex-between">
              <span style={{ color: '#ffffff', fontWeight: 700 }}>第 {q.round} 輪 {q.status === 'SUCCESS' ? '✅ 成功' : '❌ 失敗'}</span>
              <span className="text-code" style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>成功 {q.successCount} / 失敗 {q.failCount}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{teamNames(q.team)}</div>
          </div>
        ))}
        {view.lady.history.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', paddingTop: '8px' }}>
            🧜‍♀️ 仙女：{view.lady.history.map(h => `${nameOf(h.holderId)}→${nameOf(h.targetId)}`).join('、')}
          </div>
        )}
      </div>

      <div className="mt-auto flex-col gap-sm">
        {isHost ? (
          <>
            <button onClick={() => press({ action: 'START' })} disabled={isBusy || view.players.length < 5} className="btn btn-primary btn-large btn-full">
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
  view: AvalonRoomView;
  header: React.ReactNode;
  footer: React.ReactNode;
  press: (a: AvalonAction) => void;
}> = ({ view, header, footer, press }) => {
  const [seen, setSeen] = useState(false);
  const seat = view.mySeat!;
  const readyCount = view.seats.filter(s => s.ready).length;
  const waiting = view.seats.filter(s => !s.ready);
  return (
    <div className="view-container view-enter">
      {header}
      <div className="scanner-card shrink-0 mb-md">
        <div className="badge badge-classified mb-sm">🔒 你的秘密身分</div>
        <HoldToPeekRole seat={seat} onFirstReveal={() => setSeen(true)} />
      </div>

      <div className="shrink-0 mb-md">
        {seat.ready ? (
          <div className="card text-center" style={{ padding: '14px' }}>
            <div style={{ color: '#ffffff', fontWeight: 800 }}>✅ 你已準備好（{readyCount}/{view.seats.length}）</div>
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

const ProposePhase: React.FC<{ view: AvalonRoomView; isBusy: boolean; onSubmit: (team: string[]) => void }> = ({ view, isBusy, onSubmit }) => {
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
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>可以選自己；點一下選取，再點一下取消</p>
        <div className="text-code text-cyan" style={{ marginTop: '6px', fontWeight: 800 }}>已選 {picked.length} / {need}</div>
      </div>
      <div className="flex-col gap-sm shrink-0 mb-md">
        {view.seats.map(s => {
          const on = picked.includes(s.playerId);
          return (
            <button
              key={s.playerId}
              onClick={() => toggle(s.playerId)}
              className="card flex-between"
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderColor: on ? 'var(--accent-yellow)' : undefined,
                boxShadow: on ? '0 0 12px rgba(245, 158, 11, 0.35)' : undefined
              }}
            >
              <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem' }}>{s.name}{s.playerId === view.me.id ? '（你）' : ''}</span>
              <span style={{ fontSize: '0.85rem', color: on ? 'var(--accent-yellow)' : 'var(--fg-muted)' }}>{on ? '🛡️ 出任務' : '點選'}</span>
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

const AssassinatePhase: React.FC<{
  view: AvalonRoomView;
  header: React.ReactNode;
  footer: React.ReactNode;
  isBusy: boolean;
  press: (a: AvalonAction) => void;
}> = ({ view, header, footer, isBusy, press }) => {
  const [target, setTarget] = useState<string | null>(null);
  const seat = view.mySeat;
  const isAssassin = seat?.role === 'ASSASSIN';
  const isEvil = seat?.alignment === 'EVIL';

  return (
    <div className="view-container view-enter">
      {header}
      <div className="card text-center shrink-0 mb-md" style={{ padding: '18px 16px' }}>
        <div style={{ fontSize: '2.2rem' }}>🗡️</div>
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900, margin: '6px 0' }}>好人完成了三次任務！</h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem' }}>
          {isAssassin
            ? '你是刺客。跟同伴討論，猜出誰是梅林；刺中梅林，壞人逆轉獲勝。'
            : isEvil
              ? '壞人可以小聲討論誰是梅林，但只有刺客能下手。'
              : '壞人正在討論誰是梅林。梅林請保持冷靜，別露出破綻。'}
        </p>
      </div>

      {view.evilTeam && (
        <div className="card shrink-0 mb-md avalon-evil" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>🗡️ 壞人陣營</div>
          {view.evilTeam.map(e => (
            <div key={e.playerId} className="flex-between" style={{ padding: '3px 0' }}>
              <span style={{ color: '#ffffff', fontWeight: 800 }}>{e.name}{e.playerId === view.me.id ? '（你）' : ''}</span>
              {e.isAssassin && <span className="badge badge-role-spy">刺客</span>}
            </div>
          ))}
        </div>
      )}

      {isAssassin ? (
        <>
          <div className="flex-col gap-sm shrink-0 mb-md">
            {view.seats.filter(s => s.playerId !== view.me.id).map(s => {
              const on = target === s.playerId;
              return (
                <button
                  key={s.playerId}
                  onClick={() => { soundManager.playClick(); setTarget(s.playerId); }}
                  className="card flex-between"
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderColor: on ? 'var(--accent-magenta)' : undefined,
                    boxShadow: on ? 'var(--shadow-glow-magenta)' : undefined
                  }}
                >
                  <span style={{ color: '#ffffff', fontWeight: 800 }}>{s.name}</span>
                  <span style={{ fontSize: '0.85rem', color: on ? 'var(--accent-magenta)' : 'var(--fg-muted)' }}>{on ? '🎯 刺他' : '點選'}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => target && window.confirm(`確定刺殺 ${view.seats.find(s => s.playerId === target)?.name}？送出後無法更改。`) && press({ action: 'ASSASSINATE', targetId: target })}
            disabled={!target || isBusy}
            className="btn btn-danger btn-large btn-full shrink-0"
          >
            🗡️ 刺殺！
          </button>
        </>
      ) : (
        <WaitingText>⏳ 等待刺客下手…</WaitingText>
      )}
      <div className="mt-auto">{footer}</div>
    </div>
  );
};
