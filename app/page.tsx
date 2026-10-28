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

  const { currentUser, updatePlayerName } = useMultiplayerRoom();

  // 監聽網址參數，支援手機掃碼 QR Code 直接進房 (例如 ?game=sonar&room=SONAR-1234)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gameParam = params.get('game')?.toUpperCase();
      const roomParam = params.get('room');

      if (roomParam) {
        setInitialRoomId(roomParam);
      }

      // 重新整理時若還在誰是間諜的房間裡，直接帶回去
      let inSpyRoom = false;
      try { inSpyRoom = !!localStorage.getItem('spy_current_room'); } catch {}

      if (gameParam === 'SPY' || (!gameParam && inSpyRoom)) setActiveGame('SPY');
      else if (gameParam === 'AVALON') setActiveGame('AVALON');
      else if (gameParam === 'SONAR') setActiveGame('SONAR');
      else if (gameParam === 'WONDERS') setActiveGame('WONDERS');
    }
  }, []);

  // 處理手動輸入房間代碼加入
  const handleJoinByCode = async (code: string, playerName?: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    // 先存暱稱，遊戲元件掛載時會讀到並以此名稱加入
    if (playerName) updatePlayerName(playerName);

    // 誰是間諜是手機點對點連線，房號都是 SPY- 開頭，直接進遊戲連房主
    if (cleanCode.startsWith('SPY')) {
      setInitialRoomId(cleanCode);
      setActiveGame('SPY');
      return true;
    }

    try {
      const res = await fetch(`/api/rooms/${cleanCode}`);
      const data = await res.json();

      if (data.success && data.room) {
        setInitialRoomId(cleanCode);
        const gameType = data.room.gameType;

        if (gameType === 'AVALON') setActiveGame('AVALON');
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
          <SpyGame
            onBackToLobby={() => setActiveGame('LOBBY')}
            initialRoomId={initialRoomId}
          />
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
