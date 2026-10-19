// components/spy/SpyGame.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { HomeView } from '@/components/views/HomeView';
import { SetupView } from '@/components/views/SetupView';
import { RevealView } from '@/components/views/RevealView';
import { PlayView } from '@/components/views/PlayView';
import { VoteView } from '@/components/views/VoteView';
import { ResultView } from '@/components/views/ResultView';
import { WordsView } from '@/components/views/WordsView';
import { RulesModal } from '@/components/modals/RulesModal';
import { QRCodeRoomModal } from '@/components/multiplayer/QRCodeRoomModal';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';
import { SpeechLogModal } from '@/components/modals/SpeechLogModal';

interface SpyGameProps {
  onBackToLobby: () => void;
  initialRoomId?: string | null;
}

export const SpyGame: React.FC<SpyGameProps> = ({ onBackToLobby, initialRoomId }) => {
  const {
    phase,
    setPhase,
    config,
    updateConfig,
    players,
    alivePlayers,
    currentWordPair,
    speechLogs,
    recordSpeech,
    currentRevealIndex,
    round,
    startingSpeakerIndex,
    currentSpeakerIndex,
    winner,
    startNewGame,
    nextReveal,
    getCurrentRevealPlayer,
    nextSpeaker,
    getCurrentSpeaker,
    eliminatePlayerDirectly,
    advanceToNextRound
  } = useGameState();

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isSpeechLogOpen, setIsSpeechLogOpen] = useState(false);
  const roomEngine = useMultiplayerRoom(initialRoomId);

  const handleOpenRoomModal = async () => {
    let r = roomEngine.room;
    if (!r) {
      r = await roomEngine.createRoom('SPY', 12, '誰是間諜派對房');
    }
    if (r) {
      setIsRoomModalOpen(true);
    }
  };

  // 以房號／QR Code 加入成功後，顯示房間名單
  useEffect(() => {
    if (initialRoomId && roomEngine.room?.id === initialRoomId.trim().toUpperCase()) {
      setIsRoomModalOpen(true);
    }
  }, [initialRoomId, roomEngine.room?.id]);

  const handleStartGame = () => {
    startNewGame();
    setPhase('REVEAL');
  };

  const handleCompleteReveal = () => {
    setPhase('PLAY');
  };

  const handleStartVote = () => {
    setPhase('VOTE');
  };

  const handleVoteNextRound = () => {
    advanceToNextRound();
    setPhase('PLAY');
  };

  const handleGameOver = () => {
    setPhase('RESULT');
  };

  const handleReplaySame = () => {
    startNewGame();
    setPhase('REVEAL');
  };

  const currentRevealPlayer = getCurrentRevealPlayer();
  const currentSpeaker = getCurrentSpeaker();
  const startingSpeaker = players[startingSpeakerIndex];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 頂部快速返回大廳捷徑 (若在 HOME 階段) */}
      {phase === 'HOME' && (
        <div style={{ padding: '8px 16px 0', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={onBackToLobby}
            className="btn-ghost"
            style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ← 返回遊戲大廳
          </button>
        </div>
      )}

      {phase === 'HOME' && (
        <HomeView
          onSelectPhase={setPhase}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenMultiplayer={handleOpenRoomModal}
        />
      )}

      {phase === 'SETUP' && (
        <SetupView
          config={config}
          onUpdateConfig={updateConfig}
          onBack={() => setPhase('HOME')}
          onStartGame={handleStartGame}
        />
      )}

      {phase === 'REVEAL' && (
        <RevealView
          player={currentRevealPlayer}
          totalPlayers={players.length}
          currentIndex={currentRevealIndex}
          wordPair={currentWordPair}
          onNextReveal={nextReveal}
          onCompleteReveal={handleCompleteReveal}
        />
      )}

      {phase === 'PLAY' && (
        <PlayView
          round={round}
          totalPlayers={players.length}
          speechTime={config.speechTime}
          currentSpeaker={currentSpeaker}
          startingSpeaker={startingSpeaker}
          players={players}
          alivePlayers={alivePlayers}
          wordPair={currentWordPair}
          enableTTS={config.enableTTS !== false}
          speechLogs={speechLogs}
          onRecordSpeech={recordSpeech}
          onOpenSpeechLog={() => setIsSpeechLogOpen(true)}
          onNextSpeaker={nextSpeaker}
          onStartVote={handleStartVote}
        />
      )}

      {phase === 'VOTE' && (
        <VoteView
          round={round}
          alivePlayers={alivePlayers}
          showRoleOnEliminated={config.showRoleOnEliminated}
          onEliminate={eliminatePlayerDirectly}
          onNextRound={handleVoteNextRound}
          onGameOver={handleGameOver}
          onOpenSpeechLog={() => setIsSpeechLogOpen(true)}
        />
      )}

      {phase === 'RESULT' && (
        <ResultView
          winner={winner}
          wordPair={currentWordPair}
          players={players}
          speechLogs={speechLogs}
          onReplaySame={handleReplaySame}
          onReSetup={() => setPhase('SETUP')}
          onBackHome={() => setPhase('HOME')}
        />
      )}

      {phase === 'WORDS' && (
        <WordsView onBack={() => setPhase('HOME')} />
      )}

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <QRCodeRoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        room={roomEngine.room}
        isHost={roomEngine.isHost}
        onStartGame={() => {
          setIsRoomModalOpen(false);
          setPhase('SETUP');
        }}
      />
      <SpeechLogModal
        isOpen={isSpeechLogOpen}
        onClose={() => setIsSpeechLogOpen(false)}
        players={players}
        speechLogs={speechLogs}
        currentRound={round}
      />
    </div>
  );
};
