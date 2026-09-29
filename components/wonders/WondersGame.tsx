// components/wonders/WondersGame.tsx
'use client';

import React, { useState } from 'react';
import { useWondersGame } from '@/hooks/useWondersGame';
import { CityBoard } from './CityBoard';
import { DraftingHand } from './DraftingHand';
import { ConflictModal } from './ConflictModal';
import { ScoreModal } from './ScoreModal';
import { QRCodeRoomModal } from '@/components/multiplayer/QRCodeRoomModal';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';

interface WondersGameProps {
  onBackToLobby: () => void;
  initialRoomId?: string | null;
}

export const WondersGame: React.FC<WondersGameProps> = ({ onBackToLobby, initialRoomId }) => {
  const wonders = useWondersGame();
  const roomEngine = useMultiplayerRoom(initialRoomId);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  const handleOpenRoomModal = async () => {
    let r = roomEngine.room;
    if (!r) {
      r = await roomEngine.createRoom('WONDERS', 4, '七大奇蹟文明輪抽房');
    }
    if (r) {
      setIsRoomModalOpen(true);
    }
  };

  const human = wonders.humanPlayer;
  const opponents = wonders.gameState.players.filter(p => p.id !== human.id);

  return (
    <div className="view-container view-enter" style={{ paddingBottom: '30px' }}>
      {/* 頂部時代與進度橫幅 */}
      <div className="flex-between mb-sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-yellow" style={{ fontSize: '0.82rem', padding: '4px 10px', fontWeight: 900 }}>
            🏛️ 第 {wonders.gameState.age} 時代
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', fontWeight: 700 }}>
            第 {wonders.gameState.turnInAge} / 6 回合輪抽
          </span>
        </div>

        <button
          onClick={handleOpenRoomModal}
          className="btn btn-secondary"
          style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700 }}
        >
          📡 QR Code 房間
        </button>
      </div>

      {/* 左右鄰國情報速覽 */}
      <div className="flex-between mb-sm" style={{ gap: '8px' }}>
        {opponents.map(opp => {
          let oppShields = opp.builtCards.filter(c => c.category === 'MILITARY').reduce((s, c) => s + (c.provides.shields || 0), 0);
          for (const s of opp.wonder.stages) { if (s.completed && s.shields) oppShields += s.shields; }

          return (
            <div
              key={opp.id}
              className="card"
              style={{
                flex: 1,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ fontWeight: 800, color: '#ffffff' }}>
                {opp.name} ({opp.wonder.name.split(' (')[0]})
              </div>
              <div style={{ color: 'var(--fg-muted)', display: 'flex', gap: '6px', marginTop: '2px' }}>
                <span>💰 {opp.coins}金</span>
                <span>🛡️ {oppShields}盾</span>
                <span>🏛️ {opp.builtCards.length}建築</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 玩家城邦看板 (Wonder Board) */}
      <div className="mb-sm">
        <CityBoard player={human} />
      </div>

      {/* 輪抽手牌區 */}
      {wonders.gameState.phase === 'DRAFTING' && human.hand && human.hand.length > 0 && (
        <div className="mb-sm">
          <DraftingHand
            player={human}
            hand={human.hand}
            onDraftCard={wonders.confirmPlayerDraft}
          />
        </div>
      )}

      {/* 時代末軍事衝突彈窗 */}
      <ConflictModal
        results={wonders.gameState.conflictResults}
        onContinue={wonders.advanceFromConflict}
      />

      {/* 最終文明總結算彈窗 */}
      <ScoreModal
        scores={wonders.scores}
        onReplay={wonders.resetGame}
        onBackToLobby={onBackToLobby}
      />

      {/* 底部返回大廳按鈕 */}
      <div className="text-center mt-sm">
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
          wonders.resetGame();
        }}
      />
    </div>
  );
};
