'use client';

import React, { useEffect, useState } from 'react';
import { normalizeRoomCode } from '@/hooks/usePeerRoom';
import { getStoredPlayer, hasChosenName } from '@/lib/playerIdentity';
import { soundManager } from '@/lib/soundManager';
import { PeerViewBase } from '@/types/peerRoom';

// usePeerRoom 回傳值中這個畫面會用到的部分
export interface PeerRoomHandle<V extends PeerViewBase> {
  view: V | null;
  error: string | null;
  setError: (e: string | null) => void;
  isBusy: boolean;
  isResuming: boolean;
  status: 'idle' | 'connecting' | 'online' | 'reconnecting';
  createRoom: (name: string) => Promise<boolean>;
  joinRoom: (code: string, name?: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
}

interface PeerRoomScreenProps<V extends PeerViewBase> {
  room: PeerRoomHandle<V>;
  codePrefix: string;
  initialRoomId?: string | null;
  onExit: () => void;
  title: string;
  subtitle: string;
  // 房主離開會解散房間；玩家離開時的提醒文字
  leaveWarning: string;
  renderRoom: (view: V, onLeave: () => void) => React.ReactNode;
}

// 多手機房間的外框：還沒進房時顯示「填暱稱／建房／輸入房號」，進房後顯示連線狀態並交給遊戲畫面
export function PeerRoomScreen<V extends PeerViewBase>({
  room, codePrefix, initialRoomId, onExit, title, subtitle, leaveWarning, renderRoom
}: PeerRoomScreenProps<V>) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialRoomId ? normalizeRoomCode(initialRoomId, codePrefix) : '');

  useEffect(() => {
    // 沒取過暱稱就留空，讓第一次來的人填自己的名字
    if (hasChosenName()) setName(getStoredPlayer().name);
  }, []);

  // 換階段時捲回最上面，不然會停在上一個畫面的捲動位置
  const phase = room.view?.phase;
  useEffect(() => {
    document.getElementById('view-root')?.scrollTo({ top: 0 });
  }, [phase]);

  // 不用 window.confirm：LINE／IG 等 App 內建瀏覽器常會直接擋掉，按了離開會沒反應
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const handleLeave = () => {
    soundManager.playClick();
    setConfirmLeave(true);
  };
  const doLeave = async () => {
    setLeaving(true);
    await room.leaveRoom();
    setLeaving(false);
    setConfirmLeave(false);
    // 清掉網址上的房號，重新整理才不會又加回剛離開的房間
    window.history.replaceState({}, '', window.location.pathname);
    onExit();
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
        {renderRoom(room.view, handleLeave)}
        {confirmLeave && (
          <div className="modal-overlay" onClick={() => !leaving && setConfirmLeave(false)}>
            <div className="modal-sheet text-center" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: '#ffffff', fontWeight: 900, marginBottom: '10px' }}>離開房間？</h3>
              <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
                {room.view.me.isHost ? '你是房主，離開會解散房間，所有人都會被斷線。' : leaveWarning}
              </p>
              <div className="flex-col gap-sm">
                <button onClick={doLeave} disabled={leaving} className="btn btn-danger btn-large btn-full">
                  {leaving ? '離開中…' : '確定離開'}
                </button>
                <button onClick={() => setConfirmLeave(false)} disabled={leaving} className="btn btn-ghost btn-full">
                  留下來
                </button>
              </div>
            </div>
          </div>
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
        <h1 style={{ fontSize: '1.9rem', fontWeight: 900 }}>{title}</h1>
        <p style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>{subtitle}</p>
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
                placeholder={`例如 ${codePrefix}-K7Q2`}
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
}
