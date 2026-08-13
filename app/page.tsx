'use client';

import React, { useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { Header } from '@/components/Header';
import { HomeView } from '@/components/views/HomeView';
import { SetupView } from '@/components/views/SetupView';
import { RevealView } from '@/components/views/RevealView';
import { PlayView } from '@/components/views/PlayView';
import { VoteView } from '@/components/views/VoteView';
import { ResultView } from '@/components/views/ResultView';
import { WordsView } from '@/components/views/WordsView';
import { RulesModal } from '@/components/modals/RulesModal';
import { MultiplayerModal } from '@/components/modals/MultiplayerModal';

export default function GamePage() {
  const {
    phase,
    setPhase,
    config,
    updateConfig,
    players,
    alivePlayers,
    currentWordPair,
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
  const [isMultiplayerOpen, setIsMultiplayerOpen] = useState(false);

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
    <>
      <Header phase={phase} onGoHome={() => setPhase('HOME')} />

      <main id="view-root" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {phase === 'HOME' && (
          <HomeView
            onSelectPhase={setPhase}
            onOpenRules={() => setIsRulesOpen(true)}
            onOpenMultiplayer={() => setIsMultiplayerOpen(true)}
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
          />
        )}

        {phase === 'RESULT' && (
          <ResultView
            winner={winner}
            wordPair={currentWordPair}
            players={players}
            onReplaySame={handleReplaySame}
            onReSetup={() => setPhase('SETUP')}
            onBackHome={() => setPhase('HOME')}
          />
        )}

        {phase === 'WORDS' && (
          <WordsView onBack={() => setPhase('HOME')} />
        )}
      </main>

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <MultiplayerModal isOpen={isMultiplayerOpen} onClose={() => setIsMultiplayerOpen(false)} />
    </>
  );
}
