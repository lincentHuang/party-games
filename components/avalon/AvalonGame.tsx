// components/avalon/AvalonGame.tsx
'use client';

import React, { useState } from 'react';
import { useAvalonState } from '@/hooks/useAvalonState';
import { AvalonSetupView } from './views/AvalonSetupView';
import { AvalonRoleRevealView } from './views/AvalonRoleRevealView';
import { AvalonQuestView } from './views/AvalonQuestView';
import { AvalonAssassinationView } from './views/AvalonAssassinationView';
import { AvalonResultView } from './views/AvalonResultView';
import { QRCodeRoomModal } from '@/components/multiplayer/QRCodeRoomModal';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';

interface AvalonGameProps {
  onBackToLobby: () => void;
  initialRoomId?: string | null;
}

export const AvalonGame: React.FC<AvalonGameProps> = ({ onBackToLobby, initialRoomId }) => {
  const avalon = useAvalonState();
  const roomEngine = useMultiplayerRoom(initialRoomId);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  const handleOpenRoomModal = async () => {
    let r = roomEngine.room;
    if (!r) {
      r = await roomEngine.createRoom('AVALON', avalon.config.playerCount, '阿瓦隆聖杯對決房');
    }
    if (r) {
      setIsRoomModalOpen(true);
    }
  };

  const currentRevealPlayer = avalon.players[avalon.currentRevealIndex];
  const currentLeader = avalon.players[avalon.currentLeaderIndex];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 視圖切換 */}
      {avalon.phase === 'SETUP' && (
        <AvalonSetupView
          config={avalon.config}
          onUpdateConfig={avalon.setConfig}
          onStartGame={avalon.startNewGame}
          onOpenRoomModal={handleOpenRoomModal}
          onBack={onBackToLobby}
        />
      )}

      {avalon.phase === 'ROLE_REVEAL' && currentRevealPlayer && (
        <AvalonRoleRevealView
          player={currentRevealPlayer}
          currentIndex={avalon.currentRevealIndex}
          totalPlayers={avalon.players.length}
          allPlayers={avalon.players}
          onNext={avalon.nextReveal}
        />
      )}

      {(avalon.phase === 'TEAM_PROPOSE' ||
        avalon.phase === 'TEAM_VOTE' ||
        avalon.phase === 'VOTE_RESULT' ||
        avalon.phase === 'QUEST_EXECUTION' ||
        avalon.phase === 'QUEST_RESULT') && (
        <AvalonQuestView
          phase={avalon.phase}
          quests={avalon.quests}
          currentQuestIndex={avalon.currentQuestIndex}
          currentLeader={currentLeader}
          players={avalon.players}
          selectedTeam={avalon.selectedTeam}
          voteRecords={avalon.voteRecords}
          consecutiveFailedVotes={avalon.consecutiveFailedVotes}
          questCardsCount={avalon.questCards.length}
          onToggleTeamMember={avalon.toggleTeamMember}
          onConfirmTeamProposal={avalon.confirmTeamProposal}
          onSubmitVotes={avalon.submitVotes}
          onAdvanceFromVoteResult={avalon.advanceFromVoteResult}
          onSubmitQuestCard={avalon.submitQuestCard}
          onAdvanceFromQuestResult={avalon.advanceFromQuestResult}
        />
      )}

      {avalon.phase === 'ASSASSINATION' && (
        <AvalonAssassinationView
          players={avalon.players}
          onExecuteAssassination={avalon.executeAssassination}
        />
      )}

      {avalon.phase === 'RESULT' && (
        <AvalonResultView
          winner={avalon.winner}
          winReason={avalon.winReason}
          players={avalon.players}
          onReplay={avalon.startNewGame}
          onReSetup={() => avalon.setPhase('SETUP')}
          onBackToLobby={onBackToLobby}
        />
      )}

      {/* QR Code 多人連線彈窗 */}
      <QRCodeRoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        room={roomEngine.room}
        isHost={roomEngine.isHost}
        onStartGame={() => {
          setIsRoomModalOpen(false);
          avalon.startNewGame();
        }}
      />
    </div>
  );
};
