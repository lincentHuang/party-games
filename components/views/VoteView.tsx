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
}

export const VoteView: React.FC<VoteViewProps> = ({
  round,
  alivePlayers,
  showRoleOnEliminated,
  onEliminate,
  onNextRound,
  onGameOver
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

  return (
    <div className="view-container view-enter">
      {/* 頂部標題 */}
      <div className="flex-between mb-md">
        <span className="badge badge-classified">第 {round} 輪投票放逐</span>
        <span className="badge badge-cyan" style={{ fontSize: '0.82rem' }}>
          存活特工: {alivePlayers.length} 位
        </span>
      </div>

      <div className="card card-glass mb-md text-center" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '4px' }}>
          請全體特工指認間諜
        </h2>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
          請點選下方得票最多的嫌疑特工進行放逐審判：
        </p>
      </div>

      {/* 候選特工名冊 */}
      <div className="agents-grid mb-md" style={{ flex: 1, alignContent: 'start' }}>
        {alivePlayers.map(p => (
          <div
            key={p.id}
            onClick={() => handleSelectCandidate(p.id)}
            className={`agent-card ${selectedPlayerId === p.id ? 'selected-vote' : ''}`}
          >
            <div className="agent-avatar">{p.icon}</div>
            <div className="agent-info">
              <div className="agent-code">{p.code}</div>
              <div className="agent-name">{p.name}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部操作區 */}
      <div className="flex-col gap-sm" style={{ paddingBottom: '8px' }}>
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
