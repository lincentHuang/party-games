// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { LobbyHeader } from '@/components/lobby/LobbyHeader';
import { GameLobbyView } from '@/components/lobby/GameLobbyView';
import { SpyGame } from '@/components/spy/SpyGame';
import { AvalonGame } from '@/components/avalon/AvalonGame';
import { SonarGame } from '@/components/sonar/SonarGame';
import { WondersGame } from '@/components/wonders/WondersGame';
import { JoinRoomModal } from '@/components/multiplayer/JoinRoomModal';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';

type ActiveGame = 'LOBBY' | 'SPY' | 'AVALON' | 'SONAR' | 'WONDERS';

export default function PartyGamesPage() {
  const [activeGame, setActiveGame] = useState<ActiveGame>('LOBBY');
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const { currentUser, joinRoom } = useMultiplayerRoom();

  // 監聽網址參數，支援手機掃碼 QR Code 直接進房 (例如 ?game=sonar&room=SONAR-1234)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gameParam = params.get('game')?.toUpperCase();
      const roomParam = params.get('room');

      if (roomParam) {
        setInitialRoomId(roomParam);
      }

      if (gameParam === 'SPY') setActiveGame('SPY');
      else if (gameParam === 'AVALON') setActiveGame('AVALON');
      else if (gameParam === 'SONAR') setActiveGame('SONAR');
      else if (gameParam === 'WONDERS') setActiveGame('WONDERS');
    }
  }, []);

  // 處理手動輸入房間代碼加入
  const handleJoinByCode = async (code: string, playerName?: string): Promise<boolean> => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const res = await fetch(`/api/rooms/${cleanCode}`);
      const data = await res.json();

      if (data.success && data.room) {
        setInitialRoomId(cleanCode);
        const gameType = data.room.gameType;

        if (gameType === 'SPY') setActiveGame('SPY');
        else if (gameType === 'AVALON') setActiveGame('AVALON');
        else if (gameType === 'SONAR') setActiveGame('SONAR');
        else if (gameType === 'WONDERS') setActiveGame('WONDERS');

        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  return (
    <>
      {/* 頂部全域導航列 */}
      <LobbyHeader
        currentGame={activeGame}
        onGoLobby={() => {
          setActiveGame('LOBBY');
          setInitialRoomId(null);
          // 清除 URL 參數
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />

      {/* 主畫面視圖 */}
      <main id="view-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
        {activeGame === 'LOBBY' && (
          <GameLobbyView
            onSelectGame={game => {
              setActiveGame(game);
              setInitialRoomId(null);
            }}
            onOpenJoinModal={() => setIsJoinModalOpen(true)}
          />
        )}

        {activeGame === 'SPY' && (
          <SpyGame onBackToLobby={() => setActiveGame('LOBBY')} />
        )}

        {activeGame === 'AVALON' && (
          <AvalonGame
            onBackToLobby={() => setActiveGame('LOBBY')}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'SONAR' && (
          <SonarGame
            onBackToLobby={() => setActiveGame('LOBBY')}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'WONDERS' && (
          <WondersGame
            onBackToLobby={() => setActiveGame('LOBBY')}
            initialRoomId={initialRoomId}
          />
        )}
      </main>

      {/* 輸入房間代碼加入彈窗 */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={handleJoinByCode}
        initialPlayerName={currentUser.name}
      />
    </>
  );
}
