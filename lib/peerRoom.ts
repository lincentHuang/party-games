// lib/peerRoom.ts
// 各款多手機遊戲共用的小工具（只在房主手機上執行）
import { PeerHostRoomBase, PeerMutation } from '@/types/peerRoom';

// 新玩家加入或舊玩家重新連線；secret 不符代表有人冒用這個 id
export function addPeerPlayer<R extends PeerHostRoomBase>(
  room: R,
  player: { id: string; name: string; secret: string },
  maxPlayers: number
): PeerMutation<R> {
  const existing = room.players.find(p => p.id === player.id);
  if (existing) {
    if (existing.secret !== player.secret) return { error: '玩家身分驗證失敗' };
    if (player.name) existing.name = player.name;
    return { room };
  }
  if (room.players.length >= maxPlayers) return { error: '房間已滿員！' };
  room.players.push({ id: player.id, name: player.name || `玩家 ${room.players.length + 1}`, isHost: false, secret: player.secret });
  return { room };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function onlinePlayers(room: PeerHostRoomBase, onlineIds: Set<string>) {
  return room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: onlineIds.has(p.id) }));
}
