// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { LobbyHeader } from '@/components/lobby/LobbyHeader';
import { GameLobbyView } from '@/components/lobby/GameLobbyView';
import { SpyGame } from '@/components/spy/SpyGame';
import { OnlineAvalonGame } from '@/components/avalon/online/OnlineAvalonGame';
import { OnlineWerewolfGame } from '@/components/werewolf/OnlineWerewolfGame';
import { OnlineRoundtableGame } from '@/components/roundtable/OnlineRoundtableGame';
import { SonarGame } from '@/components/sonar/SonarGame';
import { WondersGame } from '@/components/wonders/WondersGame';
import { JoinRoomModal } from '@/components/multiplayer/JoinRoomModal';
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom';
import { roomCodePrefix } from '@/hooks/usePeerRoom';

type ActiveGame = 'LOBBY' | 'SPY' | 'AVALON' | 'WEREWOLF' | 'ROUNDTABLE' | 'SONAR' | 'WONDERS';

// 手機點對點的遊戲：房號前綴、localStorage 前綴（重新整理時用來回到房間）
const PEER_GAMES: { game: ActiveGame; prefix: string; storageKey: string }[] = [
  { game: 'SPY', prefix: 'SPY', storageKey: 'spy' },
  { game: 'AVALON', prefix: 'AVA', storageKey: 'avalon' },
  { game: 'WEREWOLF', prefix: 'WLF', storageKey: 'werewolf' },
  { game: 'ROUNDTABLE', prefix: 'RTW', storageKey: 'roundtable' }
];

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

      // 重新整理時若還在某個手機連線房間裡，直接帶回去
      let resumeGame: ActiveGame | null = null;
      try {
        resumeGame = PEER_GAMES.find(g => localStorage.getItem(`${g.storageKey}_current_room`))?.game || null;
      } catch {}

      if (gameParam === 'SPY') setActiveGame('SPY');
      else if (gameParam === 'AVALON') setActiveGame('AVALON');
      else if (gameParam === 'WEREWOLF') setActiveGame('WEREWOLF');
      else if (gameParam === 'ROUNDTABLE') setActiveGame('ROUNDTABLE');
      else if (!gameParam && resumeGame) setActiveGame(resumeGame);
      else if (gameParam === 'SONAR') setActiveGame('SONAR');
      else if (gameParam === 'WONDERS') setActiveGame('WONDERS');
    }
  }, []);

  // 處理手動輸入房間代碼加入
  const handleJoinByCode = async (code: string, playerName?: string): Promise<boolean> => {
    const cleanCode = code.trim().toUpperCase();
    // 先存暱稱，遊戲元件掛載時會讀到並以此名稱加入
    if (playerName) updatePlayerName(playerName);

    // 手機點對點的遊戲看房號前綴（SPY-／AVA-／WLF-），直接進遊戲連房主
    const peerGame = PEER_GAMES.find(g => g.prefix === roomCodePrefix(cleanCode));
    if (peerGame) {
      setInitialRoomId(cleanCode);
      setActiveGame(peerGame.game);
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

  // 回大廳：一併清掉網址上的 ?game=&room=，免得重新整理又被帶回剛離開的房間
  const goLobby = () => {
    setActiveGame('LOBBY');
    setInitialRoomId(null);
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <>
      {/* 頂部全域導航列 */}
      <LobbyHeader
        currentGame={activeGame}
        onGoLobby={goLobby}
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
            onBackToLobby={goLobby}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'AVALON' && (
          <OnlineAvalonGame
            onExit={goLobby}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'WEREWOLF' && (
          <OnlineWerewolfGame
            onExit={goLobby}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'ROUNDTABLE' && (
          <OnlineRoundtableGame
            onExit={goLobby}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'SONAR' && (
          <SonarGame
            onBackToLobby={goLobby}
            initialRoomId={initialRoomId}
          />
        )}

        {activeGame === 'WONDERS' && (
          <WondersGame
            onBackToLobby={goLobby}
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
