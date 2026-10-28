// hooks/useMultiplayerRoom.ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GameRoom, RoomPlayer } from '@/lib/roomStore';
import { getStoredPlayer, savePlayerName } from '@/lib/playerIdentity';

export function useMultiplayerRoom(initialRoomId?: string | null) {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string }>(() => {
    const { id, name } = getStoredPlayer();
    return { id, name };
  });
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // 只有成功 JOIN 或建房後才設定，避免以「非成員」身分輪詢
  const roomIdRef = useRef<string | null>(null);
  const autoJoinedRef = useRef<string | null>(null);
  const isPollingRef = useRef<boolean>(false);

  const updatePlayerName = useCallback((newName: string) => {
    const clean = savePlayerName(newName);
    if (!clean) return;
    setCurrentUser(prev => ({ ...prev, name: clean }));
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

  // 掃 QR Code / 輸入房號進入時，自動送出 JOIN 正式加入房間
  useEffect(() => {
    if (!initialRoomId) return;
    const id = initialRoomId.trim().toUpperCase();
    if (autoJoinedRef.current === id) return;
    autoJoinedRef.current = id;
    joinRoom(id);
  }, [initialRoomId, joinRoom]);

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
