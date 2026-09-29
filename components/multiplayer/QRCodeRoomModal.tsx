// components/multiplayer/QRCodeRoomModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { GameRoom } from '@/lib/roomStore';
import { soundManager } from '@/lib/soundManager';

interface QRCodeRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: GameRoom | null;
  onStartGame?: () => void;
  isHost: boolean;
}

export const QRCodeRoomModal: React.FC<QRCodeRoomModalProps> = ({
  isOpen,
  onClose,
  room,
  onStartGame,
  isHost
}) => {
  const [lanIp, setLanIp] = useState<string>('');
  const [useLanIp, setUseLanIp] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/network-info')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.primaryIp) {
            setLanIp(data.primaryIp);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen || !room) return null;

  // 取得目標連線 URL
  let targetUrl = '';
  if (typeof window !== 'undefined') {
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    if (useLanIp && lanIp && lanIp !== 'localhost') {
      targetUrl = `${protocol}//${lanIp}${port}?game=${room.gameType.toLowerCase()}&room=${room.id}`;
    } else {
      targetUrl = `${window.location.origin}?game=${room.gameType.toLowerCase()}&room=${room.id}`;
    }
  }

  const handleCopyLink = () => {
    soundManager.playClick();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>
            📡 多人對戰連線大廳
          </div>
          <button onClick={onClose} className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
            ✕
          </button>
        </div>

        <div className="modal-body flex-col gap-md text-center">
          {/* 房間代碼標籤 */}
          <div>
            <span className="badge badge-cyan" style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
              房間代碼
            </span>
            <div style={{
              fontFamily: 'var(--font-code)',
              fontSize: '2rem',
              fontWeight: 900,
              color: 'var(--accent-cyan-light)',
              letterSpacing: '2px',
              margin: '6px 0 2px'
            }}>
              {room.id}
            </div>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
              請好友用手機相機掃描下方 QR Code，或手動輸入房號
            </p>
          </div>

          {/* QR Code 顯示區塊 */}
          <div style={{
            background: '#ffffff',
            padding: '16px',
            borderRadius: '16px',
            margin: '0 auto',
            display: 'inline-flex',
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
          }}>
            <QRCodeSVG
              value={targetUrl || 'http://localhost:3000'}
              size={190}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* 網址複製與 IP 切換 */}
          <div className="flex-col gap-xs">
            <button
              onClick={handleCopyLink}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '8px 14px', width: '100%' }}
            >
              {copied ? '✅ 已複製連線網址！' : '📋 點擊複製連線網址'}
            </button>

            {lanIp && lanIp !== 'localhost' && (
              <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                <span>目前掃碼網址使用：</span>
                <button
                  onClick={() => setUseLanIp(!useLanIp)}
                  style={{ textDecoration: 'underline', color: 'var(--accent-cyan)' }}
                >
                  {useLanIp ? `區網 Wi-Fi (${lanIp})` : '當前網址'}
                </button>
              </div>
            )}
          </div>

          {/* 已加入玩家列表 */}
          <div className="card" style={{ padding: '12px', textAlign: 'left' }}>
            <div className="flex-between mb-xs">
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg-pure)' }}>
                👥 已加入特工 ({room.players.length}/{room.maxPlayers})
              </span>
              <span className="dot-status" />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {room.players.map((p, idx) => (
                <span
                  key={p.id}
                  className="badge"
                  style={{
                    background: p.team === 'RED' ? 'rgba(244, 63, 94, 0.2)' : p.team === 'BLUE' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.1)',
                    border: `1px solid ${p.team === 'RED' ? 'var(--accent-magenta)' : p.team === 'BLUE' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    padding: '4px 10px'
                  }}
                >
                  {p.isHost ? '👑 ' : ''}{p.name}
                  {p.team ? ` [${p.team === 'RED' ? '紅隊' : '藍隊'}]` : ''}
                </span>
              ))}
            </div>
          </div>

          {/* 開始按鈕或等待提示 */}
          {isHost ? (
            <button
              onClick={() => {
                soundManager.playClick();
                if (onStartGame) onStartGame();
              }}
              className="btn btn-primary btn-large btn-full"
              style={{ marginTop: '4px' }}
            >
              🚀 全員就緒，立即開始對戰！
            </button>
          ) : (
            <div style={{ color: 'var(--fg-secondary)', fontSize: '0.9rem', padding: '10px 0' }}>
              ⏳ 等待房主啟動遊戲中...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
