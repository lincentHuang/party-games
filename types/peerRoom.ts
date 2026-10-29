/**
 * 多手機房間共用型別：每款遊戲提供一個規則引擎（PeerGameEngine），
 * 房主手機保存完整房間（含所有人的秘密），每支手機只拿到 buildView 算出的自己視角。
 */

export interface PeerRoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  secret: string; // 只存在房主手機，用來確認重新連線的是本人
  isBot?: boolean; // 電腦玩家：由房主手機代為操作，永遠算在線
}

export interface PeerHostRoomBase {
  id: string;
  hostId: string;
  version: number;
  players: PeerRoomPlayer[];
}

export interface PeerViewBase {
  roomId: string;
  version: number;
  serverNow: number;
  hostId: string;
  me: { id: string; name: string; isHost: boolean };
  players: { id: string; name: string; isHost: boolean; online: boolean }[];
  phase: string;
}

// 每款遊戲的操作都要支援 KICK（targetId）與 LEAVE，連線層會一併處理斷線
export interface PeerActionBase {
  action: string;
  targetId?: string;
}

export type PeerMutation<R> = { room: R } | { error: string };

export interface PeerGameEngine<R extends PeerHostRoomBase, V extends PeerViewBase, A extends PeerActionBase> {
  codePrefix: string; // 房號前綴，例如 'SPY'
  storageKey: string; // localStorage 前綴，例如 'spy'
  createRoom: (roomId: string, host: PeerRoomPlayer) => R;
  addPlayer: (room: R, player: { id: string; name: string; secret: string }) => PeerMutation<R>;
  applyAction: (room: R, playerId: string, action: A) => PeerMutation<R>;
  buildView: (room: R, playerId: string, onlineIds: Set<string>) => V;
  // 電腦玩家：只看自己的視角決定下一步，沒事可做就回傳 null。
  // 有提供這個函式的遊戲，大廳才會出現「加入電腦玩家」
  botAction?: (view: V) => A | null;
}
