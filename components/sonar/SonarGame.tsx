// components/sonar/SonarGame.tsx
'use client';

import React, { useState } from 'react';
import { OceanGrid } from './OceanGrid';
import { SystemControls } from './SystemControls';
import { SonarLog } from './SonarLog';
import { useSonarGame } from '@/hooks/useSonarGame';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';
import { QRCodeRoomModal } from '@/components/multiplayer/QRCodeRoomModal';
import { GridCoord } from '@/types/sonar';
import { soundManager } from '@/lib/soundManager';

interface SonarGameProps {
  onBackToLobby: () => void;
  initialRoomId?: string | null;
}

export const SonarGame: React.FC<SonarGameProps> = ({ onBackToLobby, initialRoomId }) => {
  const [playMode, setPlayMode] = useState<'ROOM' | 'VS_AI' | 'PASS_PLAY'>('VS_AI');
  const [myTeam, setMyTeam] = useState<'RED' | 'BLUE'>('RED');
  const [isTargetingMode, setIsTargetingMode] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // 房間連線
  const roomEngine = useMultiplayerRoom(initialRoomId);

  // 判斷在房間中的陣營
  const effectiveTeam: 'RED' | 'BLUE' = playMode === 'ROOM'
    ? (roomEngine.isHost ? 'RED' : 'BLUE')
    : myTeam;

  const sonar = useSonarGame({
    myTeam: effectiveTeam,
    isVsAi: playMode === 'VS_AI',
    onSyncState: (state, event) => {
      if (playMode === 'ROOM') {
        roomEngine.updateGameState(state, undefined, event);
      }
    },
    externalState: playMode === 'ROOM' ? roomEngine.room?.gameState : undefined
  });

  const handleOpenRoomModal = async () => {
    let r = roomEngine.room;
    if (!r) {
      r = await roomEngine.createRoom('SONAR', 4, '深海潛艇魚雷對抗房');
    }
    if (r) {
      setPlayMode('ROOM');
      setIsRoomModalOpen(true);
    }
  };

  const handleSelectTarget = (coord: GridCoord) => {
    sonar.fireTorpedo(coord);
    setIsTargetingMode(false);
  };

  const isGameOver = sonar.gameState.phase === 'GAMEOVER';

  return (
    <div className="view-container view-enter" style={{ paddingBottom: '30px' }}>
      {/* 頂部戰鬥儀表列 */}
      <div className="flex-between mb-sm">
        {/* 紅隊潛艦血量 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.2rem' }}>🔴</span>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f87171' }}>
              {sonar.gameState.redSub.name.split(' ')[0]}
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              {'❤️'.repeat(sonar.gameState.redSub.hp)}{'🖤'.repeat(4 - sonar.gameState.redSub.hp)}
            </div>
          </div>
        </div>

        {/* VS 標章與回合狀態 */}
        <div className="text-center">
          <span
            className="badge"
            style={{
              background: sonar.gameState.turnTeam === 'RED' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(6, 182, 212, 0.25)',
              border: `1px solid ${sonar.gameState.turnTeam === 'RED' ? 'var(--accent-magenta)' : 'var(--accent-cyan)'}`,
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 800
            }}
          >
            {sonar.gameState.turnTeam === 'RED' ? '🔴 紅隊回合' : '🔵 藍隊回合'}
          </span>
        </div>

        {/* 藍隊潛艦血量 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#60a5fa' }}>
              {sonar.gameState.blueSub.name.split(' ')[0]}
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              {'❤️'.repeat(sonar.gameState.blueSub.hp)}{'🖤'.repeat(4 - sonar.gameState.blueSub.hp)}
            </div>
          </div>
          <span style={{ fontSize: '1.2rem' }}>🔵</span>
        </div>
      </div>

      {/* 模式切換與 QR Code 按鈕 */}
      <div className="flex-between mb-sm" style={{ gap: '8px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => {
              soundManager.playClick();
              setPlayMode('VS_AI');
            }}
            className="filter-chip"
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              background: playMode === 'VS_AI' ? 'var(--accent-cyan)' : undefined,
              color: playMode === 'VS_AI' ? '#080c16' : undefined
            }}
          >
            🤖 AI 艦長
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setPlayMode('PASS_PLAY');
            }}
            className="filter-chip"
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              background: playMode === 'PASS_PLAY' ? 'var(--accent-cyan)' : undefined,
              color: playMode === 'PASS_PLAY' ? '#080c16' : undefined
            }}
          >
            📱 單機雙人
          </button>
        </div>

        <button
          onClick={handleOpenRoomModal}
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700 }}
        >
          📡 QR Code 掃碼對戰
        </button>
      </div>

      {/* 瞄準提示橫幅 */}
      {isTargetingMode && (
        <div
          className="card mb-sm text-center animate-pulse"
          style={{
            padding: '8px 12px',
            background: 'rgba(244, 63, 94, 0.25)',
            border: '1px solid var(--accent-magenta)',
            color: '#fca5a5',
            fontSize: '0.82rem',
            fontWeight: 700
          }}
        >
          🎯 魚雷火控鎖定中：請直接點選雷達網格中【3 格射程內】的座標以發射！
        </div>
      )}

      {/* 核心海戰雷達屏 */}
      <div className="mb-sm">
        <OceanGrid
          mySub={sonar.mySub}
          isTargetingMode={isTargetingMode}
          onSelectTarget={handleSelectTarget}
          lastHitCoord={sonar.gameState.lastTorpedoHit?.coord}
        />
      </div>

      {/* 操控系統面板 */}
      <div className="mb-sm">
        <SystemControls
          mySub={sonar.mySub}
          isMyTurn={sonar.isMyTurn}
          isTargetingMode={isTargetingMode}
          onMove={sonar.moveSubmarine}
          onToggleTargeting={() => setIsTargetingMode(!isTargetingMode)}
          onPingSonar={sonar.pingSonar}
          onSurface={sonar.surfaceSub}
        />
      </div>

      {/* 聲納情報與交火日誌 */}
      <div className="mb-md">
        <SonarLog logs={sonar.gameState.logs} />
      </div>

      {/* 終局結算彈窗 */}
      {isGameOver && (
        <div className="modal-overlay">
          <div className="modal-sheet text-center" style={{ maxWidth: '400px' }}>
            <span style={{ fontSize: '3.5rem' }}>💥</span>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#ffffff', margin: '8px 0' }}>
              {sonar.gameState.winnerTeam === 'RED' ? '🔴 紅隊潛艦 大獲全勝！' : '🔵 藍隊潛艦 大獲全勝！'}
            </h2>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
              敵方艦艇耐久度已歸零，遭到深海魚雷徹底擊沉！
            </p>
            <div className="flex-col gap-sm">
              <button onClick={sonar.resetGame} className="btn btn-primary btn-large btn-full">
                🔄 重置海域，再戰一局！
              </button>
              <button onClick={onBackToLobby} className="btn btn-secondary btn-full">
                ← 返回遊戲大廳
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 底部返回大廳按鈕 */}
      <div className="text-center">
        <button
          onClick={onBackToLobby}
          className="btn-ghost"
          style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}
        >
          ← 返回遊戲大廳
        </button>
      </div>

      {/* QR Code 連線彈窗 */}
      <QRCodeRoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        room={roomEngine.room}
        isHost={roomEngine.isHost}
        onStartGame={() => {
          setIsRoomModalOpen(false);
          sonar.resetGame();
        }}
      />
    </div>
  );
};
