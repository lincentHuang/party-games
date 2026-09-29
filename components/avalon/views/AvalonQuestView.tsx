// components/avalon/views/AvalonQuestView.tsx
'use client';

import React, { useState } from 'react';
import { AvalonPlayer, QuestInfo, VoteRecord, AvalonPhase } from '@/types/avalon';
import { soundManager } from '@/lib/soundManager';

interface AvalonQuestViewProps {
  phase: AvalonPhase;
  quests: QuestInfo[];
  currentQuestIndex: number;
  currentLeader: AvalonPlayer;
  players: AvalonPlayer[];
  selectedTeam: string[];
  voteRecords: VoteRecord[];
  consecutiveFailedVotes: number;
  questCardsCount: number;
  onToggleTeamMember: (playerId: string) => void;
  onConfirmTeamProposal: () => void;
  onSubmitVotes: (votes: { voterId: string; approve: boolean }[]) => void;
  onAdvanceFromVoteResult: () => void;
  onSubmitQuestCard: (success: boolean) => void;
  onAdvanceFromQuestResult: () => void;
}

export const AvalonQuestView: React.FC<AvalonQuestViewProps> = ({
  phase,
  quests,
  currentQuestIndex,
  currentLeader,
  players,
  selectedTeam,
  voteRecords,
  consecutiveFailedVotes,
  questCardsCount,
  onToggleTeamMember,
  onConfirmTeamProposal,
  onSubmitVotes,
  onAdvanceFromVoteResult,
  onSubmitQuestCard,
  onAdvanceFromQuestResult
}) => {
  const currentQuest = quests[currentQuestIndex];

  // 投票暫存狀態 (用於單機全員投票)
  const [tempVotes, setTempVotes] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    players.forEach(p => { init[p.id] = true; });
    return init;
  });

  // 當前任務出征隊員名單
  const teamPlayers = players.filter(p => selectedTeam.includes(p.id));
  const currentSubmitter = teamPlayers[questCardsCount];

  return (
    <div className="view-container view-enter" style={{ paddingBottom: '30px' }}>
      {/* 5 輪任務進度軌道 (Quest Track) */}
      <div className="quest-track mb-md">
        {quests.map((q, idx) => {
          const isCur = idx === currentQuestIndex;
          const isDone = q.status !== 'PENDING';
          return (
            <div
              key={idx}
              className={`quest-node ${isCur ? 'quest-node-current' : ''} ${q.status === 'SUCCESS' ? 'quest-node-success' : ''} ${q.status === 'FAILED' ? 'quest-node-failed' : ''}`}
            >
              <div style={{ fontSize: '0.72rem', color: isCur ? 'var(--accent-yellow)' : 'var(--fg-muted)', fontWeight: 700 }}>
                第 {q.round} 輪
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', margin: '2px 0' }}>
                {isDone ? (q.status === 'SUCCESS' ? '🏆' : '☠️') : `${q.requiredPlayers}人`}
              </div>
              {q.requiresTwoFails && (
                <div style={{ fontSize: '0.62rem', color: '#fca5a5', fontWeight: 800 }}>
                  2失敗
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 流局計數軌道 (Failed Votes 0-5) */}
      <div className="card mb-md" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)' }}>
        <div className="flex-between mb-xs">
          <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 700 }}>
            組隊流局標記（累積 5 次流局邪惡方獲勝）
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: consecutiveFailedVotes >= 4 ? 'var(--accent-magenta)' : 'var(--accent-yellow)' }}>
            {consecutiveFailedVotes} / 5
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
          {[1, 2, 3, 4, 5].map(step => (
            <div
              key={step}
              style={{
                height: '8px',
                borderRadius: '4px',
                background: step <= consecutiveFailedVotes
                  ? 'var(--accent-magenta)'
                  : 'rgba(255,255,255,0.1)'
              }}
            />
          ))}
        </div>
      </div>

      {/* =======================
          PHASE 1: 領袖指派隊伍
          ======================= */}
      {phase === 'TEAM_PROPOSE' && (
        <div className="flex-col gap-md">
          <div className="card text-center" style={{ padding: '16px' }}>
            <span className="badge badge-cyan mb-xs">👑 當前遠征領袖</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ffffff' }}>
              【{currentLeader.name}】
            </h3>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              請與全體騎士討論，挑選 <strong className="text-cyan">{currentQuest.requiredPlayers}</strong> 名隊員出征
            </p>
          </div>

          {/* 隊員勾選卡片 */}
          <div className="card" style={{ padding: '14px' }}>
            <div className="flex-between mb-sm">
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                選取隊員 ({selectedTeam.length}/{currentQuest.requiredPlayers})
              </span>
              {selectedTeam.length === currentQuest.requiredPlayers && (
                <span className="badge badge-easy">已選滿額</span>
              )}
            </div>
            <div className="flex-col gap-xs">
              {players.map(p => {
                const isSelected = selectedTeam.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => onToggleTeamMember(p.id)}
                    className="flex-between"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: isSelected ? 'rgba(6, 182, 212, 0.18)' : 'var(--bg-elevated)',
                      border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{p.id === currentLeader.id ? '👑' : '🛡️'}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>
                        {p.name}
                      </span>
                    </div>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                        color: isSelected ? '#080c16' : 'transparent',
                        fontSize: '0.85rem',
                        fontWeight: 900
                      }}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={onConfirmTeamProposal}
            disabled={selectedTeam.length !== currentQuest.requiredPlayers}
            className="btn btn-primary btn-large btn-full"
            style={{ opacity: selectedTeam.length === currentQuest.requiredPlayers ? 1 : 0.4 }}
          >
            📋 確認出征提議，進入全體表決！
          </button>
        </div>
      )}

      {/* =======================
          PHASE 2: 全員公開投票
          ======================= */}
      {phase === 'TEAM_VOTE' && (
        <div className="flex-col gap-md">
          <div className="card text-center" style={{ padding: '16px' }}>
            <span className="badge badge-yellow mb-xs">🗳️ 圓桌表決進行中</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
              領袖提名出征名單
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', margin: '8px 0' }}>
              {teamPlayers.map(p => (
                <span key={p.id} className="badge badge-cyan" style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
                  {p.name}
                </span>
              ))}
            </div>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
              每位玩家各自表決是否贊同此隊伍出征
            </p>
          </div>

          {/* 單機模擬每位玩家表決開關 */}
          <div className="card" style={{ padding: '14px' }}>
            <div className="flex-between mb-sm">
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>玩家投票意向</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>點擊按鈕切換贊成/反對</span>
            </div>
            <div className="flex-col gap-xs">
              {players.map(p => {
                const isApprove = tempVotes[p.id];
                return (
                  <div key={p.id} className="flex-between" style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                      {p.name}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          setTempVotes(prev => ({ ...prev, [p.id]: true }));
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: isApprove ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.08)',
                          color: isApprove ? '#080c16' : 'var(--fg-muted)',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}
                      >
                        👍 贊成
                      </button>
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          setTempVotes(prev => ({ ...prev, [p.id]: false }));
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: !isApprove ? 'var(--accent-magenta)' : 'rgba(255,255,255,0.08)',
                          color: !isApprove ? '#ffffff' : 'var(--fg-muted)',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}
                      >
                        👎 反對
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => {
              const votes = players.map(p => ({
                voterId: p.id,
                approve: tempVotes[p.id]
              }));
              onSubmitVotes(votes);
            }}
            className="btn btn-primary btn-large btn-full"
          >
            📢 全員確認票數，立即公佈結果！
          </button>
        </div>
      )}

      {/* =======================
          PHASE 3: 投票結果公佈
          ======================= */}
      {phase === 'VOTE_RESULT' && (
        <div className="flex-col gap-md">
          {(() => {
            const approveCount = voteRecords.filter(r => r.approve).length;
            const isApproved = approveCount > voteRecords.length / 2;
            return (
              <div
                className="card text-center"
                style={{
                  padding: '20px 16px',
                  background: isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: `2px solid ${isApproved ? 'var(--accent-emerald)' : 'var(--accent-magenta)'}`
                }}
              >
                <span style={{ fontSize: '3rem' }}>{isApproved ? '🎉' : '❌'}</span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', margin: '6px 0' }}>
                  {isApproved ? '提議通過！隊伍出發！' : '提議遭否決！流局！'}
                </h3>
                <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem' }}>
                  贊成 {approveCount} 票 · 反對 {voteRecords.length - approveCount} 票
                </p>
              </div>
            );
          })()}

          {/* 各玩家票數明細 */}
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff', marginBottom: '8px' }}>
              📜 投票明細清單
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {voteRecords.map(r => (
                <div
                  key={r.voterId}
                  className="flex-between"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: r.approve ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    border: `1px solid ${r.approve ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>{r.voterName}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: r.approve ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>
                    {r.approve ? '贊成' : '反對'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={onAdvanceFromVoteResult} className="btn btn-primary btn-large btn-full">
            ➡️ 下一步
          </button>
        </div>
      )}

      {/* =======================
          PHASE 4: 任務秘密執行 (卡片投遞)
          ======================= */}
      {phase === 'QUEST_EXECUTION' && currentSubmitter && (
        <div className="flex-col gap-md text-center">
          <div className="card" style={{ padding: '20px 16px' }}>
            <span className="badge badge-classified mb-xs">
              出征隊員 ({questCardsCount + 1} / {teamPlayers.length})
            </span>
            <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', margin: '6px 0' }}>
              請交給【<span className="text-cyan">{currentSubmitter.name}</span>】
            </h3>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
              請其他玩家避開視線，點選出征卡片（好人僅能投成功，邪惡方可選成功或失敗）
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => onSubmitQuestCard(true)}
              className="card"
              style={{
                padding: '24px 12px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid var(--accent-emerald)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <span style={{ fontSize: '2.8rem' }}>🏆</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-emerald)', marginTop: '8px' }}>
                任務成功
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-secondary)', marginTop: '4px' }}>
                誓死效忠亞瑟王
              </p>
            </button>

            <button
              onClick={() => onSubmitQuestCard(false)}
              className="card"
              style={{
                padding: '24px 12px',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '2px solid var(--accent-magenta)',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <span style={{ fontSize: '2.8rem' }}>☠️</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--accent-magenta)', marginTop: '8px' }}>
                任務失敗
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-secondary)', marginTop: '4px' }}>
                莫甘娜暗中破壞
              </p>
            </button>
          </div>
        </div>
      )}

      {/* =======================
          PHASE 5: 任務結果大揭曉
          ======================= */}
      {phase === 'QUEST_RESULT' && (
        <div className="flex-col gap-md text-center">
          <div
            className="card"
            style={{
              padding: '24px 16px',
              background: currentQuest.status === 'SUCCESS' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `2px solid ${currentQuest.status === 'SUCCESS' ? '#3b82f6' : '#ef4444'}`
            }}
          >
            <span style={{ fontSize: '3.5rem' }}>{currentQuest.status === 'SUCCESS' ? '🛡️' : '🔥'}</span>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#ffffff', margin: '8px 0' }}>
              {currentQuest.status === 'SUCCESS' ? '第 ' + currentQuest.round + ' 輪遠征【大獲全勝】！' : '第 ' + currentQuest.round + ' 輪遠征【遭到破壞】！'}
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '14px 0' }}>
              <span className="badge badge-easy" style={{ fontSize: '0.95rem', padding: '6px 14px' }}>
                成功牌：{currentQuest.successCount} 張
              </span>
              <span className="badge badge-classified" style={{ fontSize: '0.95rem', padding: '6px 14px' }}>
                失敗牌：{currentQuest.failCount} 張
              </span>
            </div>
            {currentQuest.requiresTwoFails && (
              <p style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                * 此任務需 2 張失敗牌方算破壞，因此若僅 1 張失敗仍屬正義勝利
              </p>
            )}
          </div>

          <button onClick={onAdvanceFromQuestResult} className="btn btn-primary btn-large btn-full">
            ➡️ 進入結算與下一輪任務
          </button>
        </div>
      )}
    </div>
  );
};
