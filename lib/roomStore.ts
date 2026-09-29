// lib/roomStore.ts
// 輕量伺服器端記憶體房間存儲中心 (支援多遊戲即時房間連線)

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  lastActiveAt: number;
  ready?: boolean;
  team?: 'RED' | 'BLUE';
  extra?: Record<string, any>;
}

export interface GameRoom {
  id: string;
  gameType: 'SPY' | 'AVALON' | 'SONAR' | 'WONDERS';
  title: string;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  players: RoomPlayer[];
  maxPlayers: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  gameState: any; // 各遊戲專屬的同步狀態
  events: Array<{ id: string; timestamp: number; type: string; payload: any }>;
}

declare global {
  // eslint-disable-next-line no-var
  var __PARTY_GAMES_ROOMS__: Map<string, GameRoom> | undefined;
}

// 在 Node.js runtime 全局單例存儲
const rooms: Map<string, GameRoom> = global.__PARTY_GAMES_ROOMS__ || new Map();
if (process.env.NODE_ENV !== 'production') {
  global.__PARTY_GAMES_ROOMS__ = rooms;
}

export const roomStore = {
  // 建立房間
  createRoom(gameType: GameRoom['gameType'], hostPlayer: { id: string; name: string }, maxPlayers: number = 8, title?: string): GameRoom {
    // 產生好讀的房間代碼，例如 TORP-48, AVALON-19
    const prefix = gameType === 'SONAR' ? 'SONAR' : gameType === 'AVALON' ? 'AVALON' : gameType === 'WONDERS' ? 'WOND' : 'SPY';
    const num = Math.floor(1000 + Math.random() * 9000);
    const id = `${prefix}-${num}`;

    const host: RoomPlayer = {
      id: hostPlayer.id,
      name: hostPlayer.name || '房主',
      isHost: true,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      ready: true,
      team: 'RED'
    };

    const room: GameRoom = {
      id,
      gameType,
      title: title || `${prefix} 派對對戰房`,
      hostId: host.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      players: [host],
      maxPlayers,
      status: 'LOBBY',
      gameState: null,
      events: []
    };

    rooms.set(id, room);
    this.cleanExpiredRooms();
    return room;
  },

  // 取得房間
  getRoom(roomId: string): GameRoom | undefined {
    return rooms.get(roomId.toUpperCase().trim());
  },

  // 加入房間
  joinRoom(roomId: string, player: { id: string; name: string }): { success: boolean; room?: GameRoom; message?: string } {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, message: '找不到此房間代碼，請確認後重新輸入' };
    }

    // 若玩家已在房間中，更新活動時間與名稱
    const existingIndex = room.players.findIndex(p => p.id === player.id);
    if (existingIndex !== -1) {
      room.players[existingIndex].name = player.name || room.players[existingIndex].name;
      room.players[existingIndex].lastActiveAt = Date.now();
      room.updatedAt = Date.now();
      return { success: true, room };
    }

    // 檢查人數限制
    if (room.players.length >= room.maxPlayers) {
      return { success: false, message: '房間已滿員！' };
    }

    // 自動分配隊伍 (若是魚雷遊戲紅藍對抗)
    const redCount = room.players.filter(p => p.team === 'RED').length;
    const blueCount = room.players.filter(p => p.team === 'BLUE').length;
    const team = redCount <= blueCount ? 'RED' : 'BLUE';

    const newPlayer: RoomPlayer = {
      id: player.id,
      name: player.name || `特工 ${room.players.length + 1}`,
      isHost: false,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
      ready: false,
      team
    };

    room.players.push(newPlayer);
    room.updatedAt = Date.now();
    return { success: true, room };
  },

  // 玩家心跳 / 狀態更新
  heartbeat(roomId: string, playerId: string, isReady?: boolean, team?: 'RED' | 'BLUE'): GameRoom | undefined {
    const room = this.getRoom(roomId);
    if (!room) return undefined;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.lastActiveAt = Date.now();
      if (typeof isReady === 'boolean') player.ready = isReady;
      if (team) player.team = team;
      room.updatedAt = Date.now();
    }
    return room;
  },

  // 更新遊戲狀態 (由 Host 或任一玩家發起同步)
  updateGameState(roomId: string, gameState: any, status?: GameRoom['status'], newEvent?: { type: string; payload: any }): GameRoom | undefined {
    const room = this.getRoom(roomId);
    if (!room) return undefined;

    room.gameState = gameState;
    if (status) room.status = status;
    if (newEvent) {
      room.events.push({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: newEvent.type,
        payload: newEvent.payload
      });
      // 保持最新 50 筆事件
      if (room.events.length > 50) {
        room.events.splice(0, room.events.length - 50);
      }
    }
    room.updatedAt = Date.now();
    return room;
  },

  // 離開房間
  leaveRoom(roomId: string, playerId: string): GameRoom | undefined {
    const room = this.getRoom(roomId);
    if (!room) return undefined;

    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      rooms.delete(room.id);
      return undefined;
    }

    // 若房主離開，移交給第一位玩家
    if (room.hostId === playerId && room.players.length > 0) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }
    room.updatedAt = Date.now();
    return room;
  },

  // 清除超過 2 小時未活動的過期房間
  cleanExpiredRooms() {
    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    for (const [id, room] of rooms.entries()) {
      if (now - room.updatedAt > TWO_HOURS) {
        rooms.delete(id);
      }
    }
  }
};
