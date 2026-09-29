'use client';

import React, { useState } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Player, VictoryStatus } from '@/types/game';

interface VoteViewProps {
  round: number;
  alivePlayers: Player[];
  showRoleOnEliminated: boolean;
  onEliminate: (playerId: number) => VictoryStatus;
  onNextRound: () => void;
  onGameOver: () => void;
  onOpenSpeechLog?: () => void;
}

export const VoteView: React.FC<VoteViewProps> = ({
  round,
  alivePlayers,
  showRoleOnEliminated,
  onEliminate,
  onNextRound,
  onGameOver,
  onOpenSpeechLog
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [eliminatedModalData, setEliminatedModalData] = useState<{
    player: Player;
    victoryStatus: VictoryStatus;
  } | null>(null);

  const handleSelectCandidate = (id: number) => {
    soundManager.playClick();
    setSelectedPlayerId(id);
  };

  const handleTie = () => {
    soundManager.playClick();
    onNextRound();
  };

  const handleConfirmEliminate = () => {
    if (selectedPlayerId === null) return;
    const target = alivePlayers.find(p => p.id === selectedPlayerId);
    if (!target) return;

    soundManager.playEliminate();
    const victoryStatus = onEliminate(selectedPlayerId);
    setEliminatedModalData({
      player: target,
      victoryStatus
    });
  };

  const handleModalNextRound = () => {
    soundManager.playClick();
    setEliminatedModalData(null);
    onNextRound();
  };

  const handleModalToResult = () => {
    soundManager.playClick();
    setEliminatedModalData(null);
    onGameOver();
  };

  const selectedPlayer = alivePlayers.find(p => p.id === selectedPlayerId);
  const aliveAICount = alivePlayers.filter(p => p.isAI).length;

  return (
    <div className="view-container view-enter">
      {/* 頂部標題與速記冊捷徑 */}
      <div className="flex-between mb-sm shrink-0">
        <span className="badge badge-classified">第 {round} 輪投票放逐</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onOpenSpeechLog && (
            <button
              onClick={onOpenSpeechLog}
              className="btn btn-ghost"
              style={{ padding: '3px 8px', fontSize: '0.78rem', color: 'var(--accent-cyan-light)', border: '1px solid rgba(6, 182, 212, 0.3)' }}
            >
              📜 查看發言速記
            </button>
          )}
          <span className="badge badge-cyan" style={{ fontSize: '0.82rem' }}>
            存活: {alivePlayers.length} 位
          </span>
        </div>
      </div>

      <div className="card card-glass mb-sm text-center shrink-0" style={{ padding: '12px 14px' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '4px' }}>
          請全體特工指認間諜
        </h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.82rem', margin: 0 }}>
          {aliveAICount > 0
            ? `包含 ${aliveAICount} 位電腦特工在內，請點選得票最多之嫌疑人：`
            : '請點選下方得票最多的嫌疑特工進行放逐審判：'}
        </p>
      </div>

      {/* 候選特工名冊 */}
      <div className="agents-grid mb-md shrink-0" style={{ alignContent: 'start', gap: '8px' }}>
        {alivePlayers.map(p => (
          <div
            key={p.id}
            onClick={() => handleSelectCandidate(p.id)}
            className={`agent-card shrink-0 ${selectedPlayerId === p.id ? 'selected-vote' : ''}`}
            style={{ minHeight: '48px' }}
          >
            <div className="agent-avatar" style={{ width: '32px', height: '32px', fontSize: '1.2rem' }}>{p.icon}</div>
            <div className="agent-info">
              <div className="agent-code" style={{ fontSize: '0.68rem' }}>{p.code}</div>
              <div className="agent-name" style={{ fontSize: '0.82rem' }}>{p.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部操作區 */}
      <div className="flex-col gap-sm shrink-0" style={{ paddingBottom: '24px' }}>
        <button
          onClick={handleConfirmEliminate}
          className="btn btn-danger btn-large btn-full"
          disabled={selectedPlayerId === null}
          style={{ opacity: selectedPlayerId === null ? 0.4 : 1 }}
        >
          {selectedPlayer ? `⚖️ 確認放逐 [ ${selectedPlayer.name} ]` : '⚖️ 確定放逐選中特工'}
        </button>
        <button onClick={handleTie} className="btn btn-secondary btn-full">
          🔄 出現平票，重新發言 / 重新投票
        </button>
      </div>


      {/* 淘汰公布彈窗 */}
      {eliminatedModalData && (
        <div className="modal-overlay">
          <div className="modal-sheet" style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '6px' }}>{eliminatedModalData.player.icon}</div>
            <div className="animate-stamp-slam stamp-overlay" style={{ position: 'static', transform: 'none', display: 'inline-block', margin: '6px 0 12px', fontSize: '1.1rem', padding: '4px 16px' }}>
              SUSPECT ELIMINATED
            </div>

            <h2 style={{ fontSize: '1.6rem', color: '#ffffff', fontWeight: 800, marginBottom: '6px' }}>
              {eliminatedModalData.player.name}
            </h2>

            <div style={{ margin: '10px 0' }}>
              {showRoleOnEliminated ? (
                eliminatedModalData.player.role === 'SPY' ? (
                  <span className="badge badge-role-spy" style={{ fontSize: '0.95rem', padding: '6px 14px' }}>⚠️ 身分：間諜 (SPY)</span>
                ) : eliminatedModalData.player.role === 'CIVILIAN' ? (
                  <span className="badge badge-role-civ" style={{ fontSize: '0.95rem', padding: '6px 14px' }}>🛡️ 身分：平民 (CIVILIAN)</span>
                ) : (
                  <span className="badge badge-role-blank" style={{ fontSize: '0.95rem', padding: '6px 14px' }}>❓ 身分：白板 (BLANK)</span>
                )
              ) : (
                <span className="badge badge-classified" style={{ fontSize: '0.9rem' }}>🔒 暗牌模式 · 身分保密</span>
              )}
            </div>

            <h3 style={{ fontSize: '1.2rem', margin: '10px 0 4px' }}>
              {showRoleOnEliminated ? (
                eliminatedModalData.player.role === 'SPY' ? (
                  <span className="text-magenta">成功揪出間諜！</span>
                ) : eliminatedModalData.player.role === 'CIVILIAN' ? (
                  <span className="text-cyan">冤枉了平民特工！</span>
                ) : (
                  <span className="text-yellow">白板特工出局！</span>
                )
              ) : (
                '特工已放逐出局'
              )}
            </h3>

            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              {showRoleOnEliminated ? (
                eliminatedModalData.player.role === 'SPY'
                  ? `${eliminatedModalData.player.name} 確實為潛伏的間諜臥底！`
                  : eliminatedModalData.player.role === 'CIVILIAN'
                  ? `${eliminatedModalData.player.name} 是忠誠的特工平民。`
                  : `${eliminatedModalData.player.name} 完全沒有拿到秘密詞！`
              ) : (
                `${eliminatedModalData.player.name} 已離開特工局，身分將於終局揭曉。`
              )}
            </p>

            {/* 下一步按鈕 */}
            {eliminatedModalData.victoryStatus.isGameOver ? (
              <button onClick={handleModalToResult} className="btn btn-primary btn-large btn-full">
                🏆 任務分出勝負！查看終局復盤
              </button>
            ) : (
              <button onClick={handleModalNextRound} className="btn btn-primary btn-large btn-full">
                ▶ 進入第 {round + 1} 輪情報交換
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
