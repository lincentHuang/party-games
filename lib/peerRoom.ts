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

const BOT_NAMES = ['阿福', '小美', '大熊', '阿呆', '豆豆', '胖虎', '小葵', '阿吉', '咪咪', '老王', '小黑', '球球'];

// 電腦玩家：名字前面加 🤖，所有畫面一看就知道是電腦
export function nextBotPlayer(room: PeerHostRoomBase) {
  const used = new Set(room.players.map(p => p.name));
  const name = BOT_NAMES.map(n => `🤖 ${n}`).find(n => !used.has(n)) || `🤖 電腦${room.players.length + 1}`;
  // secret 故意短於 16 字，真人的 hello 一律會被擋，沒人能冒用電腦的身分
  return { id: `bot-${Math.random().toString(36).slice(2, 10)}`, name, secret: 'bot' };
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
