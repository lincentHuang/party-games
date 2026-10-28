'use client';

import React, { useEffect, useState } from 'react';
import { normalizeRoomCode, useSpyPeerRoom } from '@/hooks/useSpyPeerRoom';
import { getStoredPlayer, hasChosenName } from '@/lib/playerIdentity';
import { soundManager } from '@/lib/soundManager';
import { SpyRoomLobby } from './SpyRoomLobby';
import { SpyRoomGame } from './SpyRoomGame';

interface OnlineSpyGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 誰是間諜多手機版：每個人用自己的手機看詞、投票
export const OnlineSpyGame: React.FC<OnlineSpyGameProps> = ({ initialRoomId, onExit }) => {
  const room = useSpyPeerRoom(initialRoomId);
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialRoomId ? normalizeRoomCode(initialRoomId) : '');

  useEffect(() => {
    // 沒取過暱稱就留空，讓第一次來的人填自己的名字
    if (hasChosenName()) setName(getStoredPlayer().name);
  }, []);

  // 換階段時捲回最上面，不然會停在上一個畫面的捲動位置
  const phase = room.view?.phase;
  useEffect(() => {
    document.getElementById('view-root')?.scrollTo({ top: 0 });
  }, [phase]);

  const handleLeave = async () => {
    const message = room.view?.me.isHost
      ? '你是房主，離開會解散房間，所有人都會被斷線。確定嗎？'
      : '確定要離開房間嗎？對局中離開會被當成出局。';
    if (!window.confirm(message)) return;
    soundManager.playClick();
    await room.leaveRoom();
  };

  if (room.view) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {room.status === 'reconnecting' && (
          <div style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 'var(--radius-inner)', background: 'rgba(250, 204, 21, 0.12)', color: 'var(--accent-yellow)', fontSize: '0.85rem' }}>
            📡 {room.view.me.isHost ? '正在重新開放房間，玩家會自動連回來…' : '跟房主的連線中斷，正在重新連線…'}
          </div>
        )}
        {room.error && (
          <div
            onClick={() => room.setError(null)}
            style={{ margin: '8px 16px 0', padding: '8px 12px', borderRadius: 'var(--radius-inner)', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af', fontSize: '0.85rem' }}
          >
            ⚠️ {room.error}
          </div>
        )}
        {room.view.phase === 'LOBBY' ? (
          <SpyRoomLobby view={room.view} isBusy={room.isBusy} onAct={room.act} onLeave={handleLeave} />
        ) : (
          <SpyRoomGame view={room.view} isBusy={room.isBusy} onAct={room.act} onLeave={handleLeave} serverNow={room.serverNow} />
        )}
      </div>
    );
  }

  if (room.isResuming || (initialRoomId && room.isBusy)) {
    return (
      <div className="view-container flex-center">
        <p style={{ color: 'var(--fg-secondary)' }}>📡 連線房間中…</p>
      </div>
    );
  }

  const nameOk = name.trim().length > 0;

  return (
    <div className="view-container view-enter">
      <button onClick={onExit} className="btn-ghost shrink-0" style={{ alignSelf: 'flex-start', fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: '12px' }}>
        ← 返回
      </button>

      <div className="text-center mb-lg shrink-0">
        <h1 style={{ fontSize: '1.9rem', fontWeight: 900 }}>📱 每人一支手機</h1>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
          每個人在自己手機上看詞、投票，大家面對面描述就好
        </p>
      </div>

      <div className="card shrink-0 mb-md" style={{ padding: '16px' }}>
        <label style={{ fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: '8px' }}>你的暱稱</label>
        <input
          className="input-text"
          value={name}
          maxLength={12}
          onChange={e => setName(e.target.value)}
          placeholder="大家會看到這個名字"
          style={{ width: '100%' }}
        />
      </div>

      {room.error && (
        <div className="shrink-0 mb-md" style={{ padding: '10px 12px', borderRadius: 'var(--radius-inner)', background: 'rgba(244, 63, 94, 0.15)', color: '#fda4af', fontSize: '0.88rem' }}>
          ⚠️ {room.error}
        </div>
      )}

      {initialRoomId ? (
        // 掃 QR Code 進來：只需要填名字按加入
        <>
          <button
            onClick={() => { soundManager.playClick(); room.joinRoom(code, name); }}
            disabled={!nameOk || !code.trim() || room.isBusy}
            className="btn btn-primary btn-large btn-full shrink-0 mb-lg"
          >
            🚪 加入房間 {code}
          </button>
          <button
            onClick={() => { soundManager.playClick(); room.createRoom(name); }}
            disabled={!nameOk || room.isBusy}
            className="btn btn-ghost btn-full shrink-0"
            style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}
          >
            改成自己開一個新房間
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => { soundManager.playClick(); room.createRoom(name); }}
            disabled={!nameOk || room.isBusy}
            className="btn btn-primary btn-large btn-full shrink-0 mb-lg"
          >
            👑 建立房間（我當房主）
          </button>

          <div className="card shrink-0" style={{ padding: '16px' }}>
            <label style={{ fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: '8px' }}>加入朋友的房間</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input-text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="例如 SPY-K7Q2"
                style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-code)' }}
              />
              <button
                onClick={() => { soundManager.playClick(); room.joinRoom(code, name); }}
                disabled={!nameOk || !code.trim() || room.isBusy}
                className="btn btn-secondary"
              >
                加入
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
