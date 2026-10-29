// hooks/usePeerRoom.ts
// 多手機房間（PeerJS 點對點），各款遊戲共用：
// 房主手機保存完整狀態並執行該遊戲的規則引擎，其他手機直接連到房主，只送出操作、收自己的視角。
// 不需要自己的伺服器或資料庫，只用 PeerJS 公開的配對伺服器交換連線資訊。
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { DataConnection, Peer as PeerInstance } from 'peerjs';
import { getStoredPlayer, hasChosenName, savePlayerName } from '@/lib/playerIdentity';
import { nextBotPlayer } from '@/lib/peerRoom';
import { PeerActionBase, PeerGameEngine, PeerHostRoomBase, PeerMutation, PeerViewBase } from '@/types/peerRoom';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RETRY_MS = 2500;
const GUEST_MAX_RETRIES = 48; // 約 2 分鐘連不到房主就放棄
const BOT_DELAY_MS = [900, 2400]; // 電腦玩家每一步隨機等一下，像真人在想

type PeerMessage =
  | { type: 'hello'; id: string; secret: string; name: string }
  | { type: 'action'; reqId: string; action: PeerActionBase }
  | { type: 'view'; view: PeerViewBase }
  | { type: 'result'; reqId: string; ok: boolean; message?: string }
  | { type: 'error'; message: string }
  | { type: 'kicked' }
  | { type: 'closed' };

export type LinkStatus = 'idle' | 'connecting' | 'online' | 'reconnecting';

interface Session {
  role: 'host' | 'guest';
  roomId: string;
}

// 房號前綴決定是哪款遊戲，例如 SPY-K7Q2、AVA-K7Q2、WLF-K7Q2
// 「spy-k7q2」「K7Q2」都轉成「SPY-K7Q2」
export function normalizeRoomCode(input: string, prefix: string): string {
  const code = input.trim().toUpperCase().replace(new RegExp(`^${prefix}-?`), '').replace(/[^A-Z0-9]/g, '');
  return `${prefix}-${code}`;
}

// 從房號判斷是哪款遊戲（大廳輸入房號時用）
export function roomCodePrefix(input: string): string {
  return input.trim().toUpperCase().match(/^([A-Z]{3})-?[A-Z0-9]{4}$/)?.[1] || '';
}

const peerIdFor = (prefix: string, roomId: string) =>
  `lincent-party-${prefix.toLowerCase()}-` + roomId.replace(new RegExp(`^${prefix}-`), '').toLowerCase();

function randomCode(prefix: string): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `${prefix}-${code}`;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function createPeer(id?: string): Promise<PeerInstance> {
  const { Peer } = await import('peerjs');
  return id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
}

function waitForOpen(peer: PeerInstance): Promise<void> {
  return new Promise((resolve, reject) => {
    if (peer.open) return resolve();
    const onOpen = () => { cleanup(); resolve(); };
    const onError = (err: { type: string }) => { cleanup(); reject(err); };
    const cleanup = () => { peer.off('open', onOpen); peer.off('error', onError); };
    peer.on('open', onOpen);
    peer.on('error', onError);
  });
}

function peerErrorMessage(err: any): string {
  switch (err?.type) {
    case 'peer-unavailable': return '找不到這個房間。請確認房號，並請房主保持遊戲畫面開著';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return '連不上配對伺服器，請檢查網路';
    case 'browser-incompatible': return '這個瀏覽器不支援點對點連線，請改用 Chrome 或 Safari';
    default: return err?.message || '連線失敗';
  }
}

export function usePeerRoom<R extends PeerHostRoomBase, V extends PeerViewBase, A extends PeerActionBase>(
  engine: PeerGameEngine<R, V, A>,
  initialRoomId?: string | null
) {
  const PREFIX = engine.codePrefix;
  const SESSION_KEY = `${engine.storageKey}_current_room`;
  const HOST_ROOM_KEY = `${engine.storageKey}_host_room`;
  const [view, setView] = useState<V | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [status, setStatus] = useState<LinkStatus>('idle');

  const viewRef = useRef<V | null>(null);
  const clockOffsetRef = useRef(0);
  const peerRef = useRef<PeerInstance | null>(null);
  const roleRef = useRef<'host' | 'guest' | null>(null);
  // 每次建立／拆掉連線就換一代，舊的非同步回呼看到代數不同就不動作
  const genRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<any>(null);

  // 房主專用
  const roomRef = useRef<R | null>(null);
  const connsRef = useRef<Map<string, DataConnection>>(new Map());
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleBotsRef = useRef<() => void>(() => {});

  // 玩家專用
  const hostConnRef = useRef<DataConnection | null>(null);
  const guestRoomIdRef = useRef<string | null>(null);
  const guestRetriesRef = useRef(0);
  const pendingRef = useRef<Map<string, (r: { ok: boolean; message?: string }) => void>>(new Map());

  const applyView = useCallback((next: V) => {
    // 慢回來的舊狀態不能蓋掉較新的狀態
    const cur = viewRef.current;
    if (cur && cur.roomId === next.roomId && next.version < cur.version) return;
    viewRef.current = next;
    setView(next);
    clockOffsetRef.current = next.serverNow - Date.now();
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLockRef.current = await (navigator as any).wakeLock?.request('screen');
    } catch {}
  }, []);

  // 拆掉連線；keepSession=true 時保留紀錄，下次開頁面會自動回房（例如元件卸載）
  const teardown = useCallback((message: string | null, keepSession = false) => {
    genRef.current++;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    botTimerRef.current = null;
    connsRef.current.forEach(c => c.close());
    connsRef.current.clear();
    hostConnRef.current?.close();
    hostConnRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    pendingRef.current.forEach(resolve => resolve({ ok: false, message: '連線已中斷' }));
    pendingRef.current.clear();
    wakeLockRef.current?.release?.().catch(() => {});
    wakeLockRef.current = null;
    if (!keepSession) {
      writeJSON(SESSION_KEY, null);
      writeJSON(HOST_ROOM_KEY, null);
      roleRef.current = null;
      roomRef.current = null;
      guestRoomIdRef.current = null;
      viewRef.current = null;
      setView(null);
      setStatus('idle');
      setError(message);
    }
  }, []);

  // ───────── 房主 ─────────

  const hostOnlineIds = useCallback((room: R) => {
    const online = new Set<string>([room.hostId]);
    connsRef.current.forEach((c, id) => { if (c.open) online.add(id); });
    room.players.forEach(p => { if (p.isBot) online.add(p.id); });
    return online;
  }, []);

  const hostPublish = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    const online = hostOnlineIds(room);
    writeJSON(HOST_ROOM_KEY, room);
    applyView(engine.buildView(room, room.hostId, online));
    connsRef.current.forEach((conn, id) => {
      if (conn.open) conn.send({ type: 'view', view: engine.buildView(room, id, online) } satisfies PeerMessage);
    });
    scheduleBotsRef.current();
  }, [applyView, engine, HOST_ROOM_KEY, hostOnlineIds]);

  const hostMutate = useCallback((fn: (room: R) => PeerMutation<R>): string | null => {
    const current = roomRef.current;
    if (!current) return '房間不存在';
    const result = fn(structuredClone(current));
    if ('error' in result) return result.error;
    roomRef.current = { ...result.room, version: current.version + 1 };
    hostPublish();
    return null;
  }, [hostPublish]);

  // 電腦玩家：每次狀態變動後排一次，輪流問每個電腦要不要動作，一次只做一步
  scheduleBotsRef.current = () => {
    const room = roomRef.current;
    if (botTimerRef.current || !engine.botAction || !room?.players.some(p => p.isBot)) return;
    const [min, max] = BOT_DELAY_MS;
    botTimerRef.current = setTimeout(() => {
      botTimerRef.current = null;
      const current = roomRef.current;
      if (!current || roleRef.current !== 'host' || !engine.botAction) return;
      const online = hostOnlineIds(current);
      const bots = current.players.filter(p => p.isBot).sort(() => Math.random() - 0.5);
      for (const bot of bots) {
        const action = engine.botAction(engine.buildView(current, bot.id, online));
        if (!action) continue;
        const before = JSON.stringify(current);
        const result = engine.applyAction(structuredClone(current), bot.id, action);
        // 失敗或沒改變任何東西就換下一個電腦，避免同一步無限重來
        if ('error' in result || JSON.stringify(result.room) === before) continue;
        roomRef.current = { ...result.room, version: current.version + 1 };
        hostPublish();
        return;
      }
    }, min + Math.random() * (max - min));
  };

  const hostAddBot = useCallback((): string | null => hostMutate(room => {
    const result = engine.addPlayer(room, nextBotPlayer(room));
    if ('error' in result) return result;
    const added = result.room.players[result.room.players.length - 1];
    if (added) added.isBot = true;
    return result;
  }), [hostMutate, engine]);

  const hostKick = useCallback((playerId: string) => {
    const conn = connsRef.current.get(playerId);
    if (!conn) return;
    connsRef.current.delete(playerId);
    try { conn.send({ type: 'kicked' } satisfies PeerMessage); } catch {}
    setTimeout(() => conn.close(), 300);
  }, []);

  const hostAttachConn = useCallback((conn: DataConnection) => {
    let boundId: string | null = null;

    conn.on('data', raw => {
      const msg = raw as PeerMessage;
      if (!roomRef.current || !msg || typeof msg !== 'object') return;

      if (msg.type === 'hello') {
        const id = String(msg.id || '');
        const secret = String(msg.secret || '');
        const name = String(msg.name || '').trim().slice(0, 12);
        if (!/^[\w-]{4,40}$/.test(id) || secret.length < 16 || id === roomRef.current.hostId) {
          conn.send({ type: 'error', message: '玩家身分無效' } satisfies PeerMessage);
          return;
        }
        const err = hostMutate(room => engine.addPlayer(room, { id, name, secret }));
        if (err) {
          conn.send({ type: 'error', message: err } satisfies PeerMessage);
          setTimeout(() => conn.close(), 300);
          return;
        }
        const old = connsRef.current.get(id);
        if (old && old !== conn) old.close();
        connsRef.current.set(id, conn);
        boundId = id;
        hostPublish();
        return;
      }

      if (msg.type === 'action' && boundId && msg.action && typeof msg.action === 'object') {
        const playerId = boundId;
        const err = hostMutate(room => engine.applyAction(room, playerId, msg.action as A));
        conn.send({ type: 'result', reqId: msg.reqId, ok: !err, message: err || undefined } satisfies PeerMessage);
        if (!err && msg.action.action === 'LEAVE') {
          connsRef.current.delete(playerId);
          boundId = null;
          setTimeout(() => conn.close(), 300);
          hostPublish();
        }
      }
    });

    conn.on('close', () => {
      if (boundId && connsRef.current.get(boundId) === conn) {
        connsRef.current.delete(boundId);
        hostPublish();
      }
    });
    conn.on('error', () => {});
  }, [hostMutate, hostPublish, engine]);

  // 用房號當 peer id 上線；房號被占用時（例如剛重新整理，舊連線還沒釋放）回傳錯誤
  const openHostPeer = useCallback(async (roomId: string, gen: number) => {
    const peer = await createPeer(peerIdFor(PREFIX, roomId));
    if (gen !== genRef.current) { peer.destroy(); throw { type: 'stale' }; }
    try {
      await waitForOpen(peer);
    } catch (err) {
      peer.destroy();
      throw err;
    }
    if (gen !== genRef.current) { peer.destroy(); throw { type: 'stale' }; }
    peerRef.current = peer;
    peer.on('connection', hostAttachConn);
    peer.on('disconnected', () => {
      // 跟配對伺服器斷了（已連上的玩家不受影響），自動重連讓新玩家還能加入
      if (gen === genRef.current && !peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), RETRY_MS);
    });
    peer.on('error', () => {});
  }, [hostAttachConn, PREFIX]);

  const resumeHost = useCallback((room: R) => {
    const gen = ++genRef.current;
    roleRef.current = 'host';
    roomRef.current = room;
    connsRef.current.clear();
    hostPublish();
    setStatus('reconnecting');
    requestWakeLock();

    const attempt = async () => {
      try {
        await openHostPeer(room.id, gen);
        setStatus('online');
      } catch (err: any) {
        if (err?.type === 'stale' || gen !== genRef.current) return;
        // 舊的房號登記要等配對伺服器釋放，持續重試
        retryTimerRef.current = setTimeout(attempt, RETRY_MS);
      }
    };
    attempt();
  }, [hostPublish, openHostPeer, requestWakeLock]);

  const createRoom = useCallback(async (name: string) => {
    setIsBusy(true);
    setError(null);
    const cleanName = savePlayerName(name) || getStoredPlayer().name;
    const me = getStoredPlayer();
    const gen = ++genRef.current;
    try {
      let roomId = '';
      for (let i = 0; i < 6 && !roomId; i++) {
        const candidate = randomCode(PREFIX);
        try {
          await openHostPeer(candidate, gen);
          roomId = candidate;
        } catch (err: any) {
          if (err?.type !== 'unavailable-id') throw err;
        }
      }
      if (!roomId) throw new Error('建立房間失敗，請再試一次');

      roleRef.current = 'host';
      roomRef.current = engine.createRoom(roomId, { id: me.id, name: cleanName, isHost: true, secret: me.secret });
      writeJSON(SESSION_KEY, { role: 'host', roomId } satisfies Session);
      hostPublish();
      setStatus('online');
      requestWakeLock();
      return true;
    } catch (err: any) {
      if (err?.type !== 'stale') setError(peerErrorMessage(err));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [hostPublish, openHostPeer, requestWakeLock, engine, PREFIX, SESSION_KEY]);

  // ───────── 玩家 ─────────

  const guestConnect = useCallback(async (roomId: string, gen: number): Promise<void> => {
    let peer = peerRef.current;
    if (!peer || peer.destroyed) {
      peer = await createPeer();
      if (gen !== genRef.current) { peer.destroy(); throw { type: 'stale' }; }
      peerRef.current = peer;
      peer.on('error', () => {});
    } else if (peer.disconnected) {
      peer.reconnect();
    }
    await waitForOpen(peer);
    if (gen !== genRef.current) throw { type: 'stale' };

    const me = getStoredPlayer();
    const conn = peer.connect(peerIdFor(PREFIX, roomId), { reliable: true, serialization: 'json' });

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer!.off('error', onPeerError);
        if (err) { conn.close(); reject(err); } else resolve();
      };
      const onPeerError = (err: any) => done(err);
      const timer = setTimeout(() => done({ type: 'timeout', message: '連不上房主，請確認房主的遊戲畫面開著' }), 15000);
      peer!.on('error', onPeerError);

      conn.on('open', () => {
        conn.send({ type: 'hello', id: me.id, secret: me.secret, name: me.name } satisfies PeerMessage);
      });

      conn.on('data', raw => {
        const msg = raw as PeerMessage;
        if (gen !== genRef.current) return;
        if (msg.type === 'view') {
          hostConnRef.current = conn;
          guestRetriesRef.current = 0;
          applyView(msg.view as V);
          setStatus('online');
          done();
        } else if (msg.type === 'result') {
          pendingRef.current.get(msg.reqId)?.(msg);
          pendingRef.current.delete(msg.reqId);
        } else if (msg.type === 'error') {
          if (!settled) done({ type: 'host-error', message: msg.message });
          else setError(msg.message);
        } else if (msg.type === 'kicked') {
          teardown('你已被房主移出房間');
        } else if (msg.type === 'closed') {
          teardown('房主已解散房間');
        }
      });

      conn.on('close', () => {
        if (!settled) return done({ type: 'timeout', message: '連線被中斷' });
        if (gen !== genRef.current || hostConnRef.current !== conn) return;
        hostConnRef.current = null;
        setStatus('reconnecting');
        scheduleGuestReconnect(gen);
      });
      conn.on('error', () => {});
    });
  }, [applyView, teardown]); // eslint-disable-line react-hooks/exhaustive-deps

  // 跟房主斷線（房主鎖屏、網路切換）就每 2.5 秒重連，約 2 分鐘後放棄
  const scheduleGuestReconnect = useCallback((gen: number) => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(async () => {
      const roomId = guestRoomIdRef.current;
      if (!roomId || gen !== genRef.current || hostConnRef.current?.open) return;
      try {
        await guestConnect(roomId, gen);
      } catch (err: any) {
        if (err?.type === 'stale' || gen !== genRef.current) return;
        if (err?.type === 'host-error') return teardown(err.message);
        guestRetriesRef.current++;
        if (guestRetriesRef.current > GUEST_MAX_RETRIES) teardown('一直連不到房主，房間可能已解散');
        else scheduleGuestReconnect(gen);
      }
    }, RETRY_MS);
  }, [guestConnect, teardown]);

  const joinRoom = useCallback(async (code: string, name?: string, silent = false) => {
    const roomId = normalizeRoomCode(code, PREFIX);
    if (roomId.length < 6) {
      setError('請輸入房號');
      return false;
    }
    setIsBusy(true);
    if (!silent) setError(null);
    if (name) savePlayerName(name);
    // 換房前先拆掉舊連線
    if (roleRef.current) teardown(null);
    const gen = ++genRef.current;
    roleRef.current = 'guest';
    guestRoomIdRef.current = roomId;
    guestRetriesRef.current = 0;
    setStatus('connecting');
    try {
      await guestConnect(roomId, gen);
      writeJSON(SESSION_KEY, { role: 'guest', roomId } satisfies Session);
      return true;
    } catch (err: any) {
      if (err?.type === 'stale') return false;
      teardown(silent ? null : err?.message && err.type !== 'peer-unavailable' ? err.message : peerErrorMessage(err));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [guestConnect, teardown]);

  // ───────── 共用操作 ─────────

  const act = useCallback(async (action: A): Promise<boolean> => {
    if (roleRef.current === 'host') {
      const room = roomRef.current;
      if (!room) return false;
      const err = action.action === 'ADD_BOT'
        ? hostAddBot()
        : hostMutate(r => engine.applyAction(r, room.hostId, action));
      if (!err && action.action === 'KICK' && action.targetId) hostKick(action.targetId);
      setError(err);
      return !err;
    }

    const conn = hostConnRef.current;
    if (!conn?.open) {
      setError('跟房主的連線中斷了，正在重新連線…');
      return false;
    }
    setIsBusy(true);
    const reqId = Math.random().toString(36).slice(2, 10);
    const result = await new Promise<{ ok: boolean; message?: string }>(resolve => {
      const timer = setTimeout(() => {
        pendingRef.current.delete(reqId);
        resolve({ ok: false, message: '房主沒有回應，請再試一次' });
      }, 8000);
      pendingRef.current.set(reqId, r => { clearTimeout(timer); resolve(r); });
      conn.send({ type: 'action', reqId, action } satisfies PeerMessage);
    });
    setIsBusy(false);
    setError(result.ok ? null : result.message || '操作失敗');
    return result.ok;
  }, [hostMutate, hostKick, hostAddBot, engine]);

  const leaveRoom = useCallback(async () => {
    if (roleRef.current === 'host') {
      connsRef.current.forEach(conn => {
        try { conn.send({ type: 'closed' } satisfies PeerMessage); } catch {}
      });
      // 讓「房間解散」訊息送出去再斷線
      await new Promise(r => setTimeout(r, 300));
    } else if (hostConnRef.current?.open) {
      await act({ action: 'LEAVE' } as A);
    }
    teardown(null);
  }, [act, teardown]);

  // ───────── 進入頁面：掃碼加入，或回到上次的房間 ─────────

  useEffect(() => {
    const session = readJSON<Session>(SESSION_KEY);
    const wanted = initialRoomId ? normalizeRoomCode(initialRoomId, PREFIX) : null;

    if (session?.role === 'host' && (!wanted || wanted === session.roomId)) {
      const saved = readJSON<R>(HOST_ROOM_KEY);
      if (saved && saved.id === session.roomId) resumeHost(saved);
      else writeJSON(SESSION_KEY, null);
    } else if (wanted) {
      // 沒取過暱稱的新手機先停在表單填名字
      if (hasChosenName()) joinRoom(wanted);
    } else if (session?.role === 'guest') {
      setIsResuming(true);
      joinRoom(session.roomId, undefined, true).finally(() => setIsResuming(false));
    }

    // 卸載時只斷線、保留紀錄，回到這個畫面會自動回房
    return () => teardown(null, true);
  }, [initialRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 手機從背景切回來：玩家立刻重連房主；房主重新跟配對伺服器報到並保持螢幕常亮
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      if (roleRef.current === 'guest' && !hostConnRef.current?.open && guestRoomIdRef.current) {
        guestRetriesRef.current = 0;
        scheduleGuestReconnect(genRef.current);
      }
      if (roleRef.current === 'host') {
        const peer = peerRef.current;
        if (peer && peer.disconnected && !peer.destroyed) peer.reconnect();
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scheduleGuestReconnect, requestWakeLock]);

  const serverNow = useCallback(() => Date.now() + clockOffsetRef.current, []);

  return { view, error, setError, isBusy, isResuming, status, createRoom, joinRoom, act, leaveRoom, serverNow };
}
