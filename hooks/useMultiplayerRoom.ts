// hooks/useMultiplayerRoom.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameRoom, RoomPlayer } from '@/lib/roomStore';

function getStoredPlayer(): { id: string; name: string } {
  if (typeof window === 'undefined') {
    return { id: 'player_server', name: '玩家' };
  }
  let id = localStorage.getItem('party_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('party_player_id', id);
  }
  let name = localStorage.getItem('party_player_name') || '';
  if (!name) {
    name = '特工 ' + id.substring(2, 5).toUpperCase();
    localStorage.setItem('party_player_name', name);
  }
  return { id, name };
}

export function useMultiplayerRoom(initialRoomId?: string | null) {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string }>(getStoredPlayer);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const roomIdRef = useRef<string | null>(initialRoomId || null);
  const isPollingRef = useRef<boolean>(false);

  const updatePlayerName = useCallback((newName: string) => {
    if (!newName.trim()) return;
    const clean = newName.trim().substring(0, 12);
    setCurrentUser(prev => {
      const updated = { ...prev, name: clean };
      if (typeof window !== 'undefined') {
        localStorage.setItem('party_player_name', clean);
      }
      return updated;
    });
  }, []);

  // 取得最新房間資料
  const fetchRoom = useCallback(async (rId: string) => {
    try {
      const res = await fetch(`/api/rooms/${rId}`);
      const data = await res.json();
      if (data.success && data.room) {
        setRoom(data.room);
        const me = data.room.players.find((p: RoomPlayer) => p.id === currentUser.id);
        setIsHost(!!me?.isHost);
        return data.room;
      } else {
        setError(data.message || '無法取得房間');
        return null;
      }
    } catch (e: any) {
      // 網路瞬斷不直接中斷
      return null;
    }
  }, [currentUser.id]);

  // 建立房間
  const createRoom = useCallback(async (gameType: GameRoom['gameType'], maxPlayers: number = 8, title?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType,
          playerId: currentUser.id,
          playerName: currentUser.name,
          maxPlayers,
          title
        })
      });
      const data = await res.json();
      if (data.success && data.room) {
        setRoom(data.room);
        roomIdRef.current = data.room.id;
        setIsHost(true);
        return data.room;
      } else {
        setError(data.message || '建立房間失敗');
        return null;
      }
    } catch (e: any) {
      setError(e.message || '網路連線錯誤');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // 加入房間
  const joinRoom = useCallback(async (roomIdToJoin: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const cleanId = roomIdToJoin.trim().toUpperCase();
      const res = await fetch(`/api/rooms/${cleanId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN',
          player: currentUser
        })
      });
      const data = await res.json();
      if (data.success && data.room) {
        setRoom(data.room);
        roomIdRef.current = data.room.id;
        const me = data.room.players.find((p: RoomPlayer) => p.id === currentUser.id);
        setIsHost(!!me?.isHost);
        return data.room;
      } else {
        setError(data.message || '加入房間失敗');
        return null;
      }
    } catch (e: any) {
      setError(e.message || '網路連線錯誤');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // 更新遊戲狀態
  const updateGameState = useCallback(async (newState: any, status?: GameRoom['status'], event?: { type: string; payload: any }) => {
    if (!roomIdRef.current) return;
    try {
      const res = await fetch(`/api/rooms/${roomIdRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATE',
          gameState: newState,
          status,
          event
        })
      });
      const data = await res.json();
      if (data.success && data.room) {
        setRoom(data.room);
      }
    } catch (e) {
      console.error('Update state failed', e);
    }
  }, []);

  // 設置準備 / 切換隊伍
  const setPlayerOptions = useCallback(async (isReady?: boolean, team?: 'RED' | 'BLUE') => {
    if (!roomIdRef.current) return;
    try {
      const res = await fetch(`/api/rooms/${roomIdRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'HEARTBEAT',
          playerId: currentUser.id,
          isReady,
          team
        })
      });
      const data = await res.json();
      if (data.success && data.room) {
        setRoom(data.room);
      }
    } catch (e) {
      console.error('Set player options failed', e);
    }
  }, [currentUser.id]);

  // 離開房間
  const leaveRoom = useCallback(async () => {
    if (!roomIdRef.current) return;
    try {
      await fetch(`/api/rooms/${roomIdRef.current}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LEAVE',
          playerId: currentUser.id
        })
      });
    } catch (e) {
      // ignore
    } finally {
      roomIdRef.current = null;
      setRoom(null);
      setIsHost(false);
    }
  }, [currentUser.id]);

  // 啟動輪詢心跳 (750ms)
  useEffect(() => {
    if (!roomIdRef.current) return;
    let timer: NodeJS.Timeout;
    isPollingRef.current = true;

    const poll = async () => {
      if (!roomIdRef.current || !isPollingRef.current) return;
      await fetchRoom(roomIdRef.current);
      if (isPollingRef.current) {
        timer = setTimeout(poll, 750);
      }
    };

    poll();

    return () => {
      isPollingRef.current = false;
      clearTimeout(timer);
    };
  }, [room?.id, fetchRoom]);

  return {
    currentUser,
    updatePlayerName,
    room,
    isHost,
    isLoading,
    error,
    createRoom,
    joinRoom,
    updateGameState,
    setPlayerOptions,
    leaveRoom,
    refreshRoom: () => roomIdRef.current ? fetchRoom(roomIdRef.current) : Promise.resolve(null)
  };
}
