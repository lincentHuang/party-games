'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { soundManager } from '@/lib/soundManager';
import { PeerViewBase } from '@/types/peerRoom';

// 本機開發時手機連不到 localhost，改用電腦的區網 IP；部署後直接用目前網址
export function useJoinUrl(gameParam: string, roomId: string) {
  const [lanIp, setLanIp] = useState('');
  const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    if (!isLocalhost) return;
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => { if (data.success && data.primaryIp) setLanIp(data.primaryIp); })
      .catch(() => {});
  }, [isLocalhost]);

  if (typeof window === 'undefined') return '';
  const origin = isLocalhost && lanIp && lanIp !== 'localhost'
    ? `${window.location.protocol}//${lanIp}${window.location.port ? `:${window.location.port}` : ''}`
    : window.location.origin;
  return `${origin}/?game=${gameParam}&room=${roomId}`;
}

// 房號、QR Code、邀請連結
export const RoomInviteCard: React.FC<{ view: PeerViewBase; gameParam: string }> = ({ view, gameParam }) => {
  const joinUrl = useJoinUrl(gameParam, view.roomId);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    soundManager.playClick();
    navigator.clipboard?.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card text-center shrink-0 mb-md" style={{ padding: '16px' }}>
      <span className="badge badge-cyan" style={{ fontSize: '0.8rem' }}>房間代碼</span>
      <div style={{ fontFamily: 'var(--font-code)', fontSize: '2rem', fontWeight: 900, color: 'var(--accent-cyan-light)', letterSpacing: '2px', margin: '4px 0 10px' }}>
        {view.roomId}
      </div>
      <div style={{ background: '#ffffff', padding: '12px', borderRadius: '14px', display: 'inline-flex' }}>
        <QRCodeSVG value={joinUrl || view.roomId} size={150} level="M" />
      </div>
      <p style={{ color: 'var(--fg-secondary)', fontSize: '0.82rem', margin: '10px 0 8px' }}>
        朋友用手機相機掃碼，或在大廳輸入房號加入
      </p>
      {view.me.isHost && (
        <p style={{ color: 'var(--accent-yellow)', fontSize: '0.8rem', margin: '0 0 8px' }}>
          ⚠️ 你的手機就是這場遊戲的主機，請保持這個畫面開著、不要鎖螢幕
        </p>
      )}
      <button onClick={handleCopy} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem', padding: '8px 14px' }}>
        {copied ? '✅ 已複製邀請連結' : '📋 複製邀請連結'}
      </button>
    </div>
  );
};

// 已加入的玩家名單（房主可移出）
// onAddBot：有給才顯示「加入電腦玩家」（房主、大廳階段）
export const RoomPlayerList: React.FC<{ view: PeerViewBase; onKick: (id: string) => void; onAddBot?: () => void }> = ({ view, onKick, onAddBot }) => (
  <div className="card shrink-0 mb-md" style={{ padding: '14px' }}>
    <div className="flex-between mb-sm">
      <span style={{ fontWeight: 800, color: 'var(--fg-pure)' }}>👥 已加入 {view.players.length} 人</span>
      <span className="dot-status" />
    </div>
    <div className="flex-col gap-sm">
      {view.players.map(p => (
        <div key={p.id} className="flex-between" style={{ padding: '8px 10px', borderRadius: 'var(--radius-inner)', background: 'var(--bg-elevated)' }}>
          <span style={{ color: p.online ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
            <span style={{ color: p.online ? 'var(--accent-emerald)' : 'var(--fg-muted)', marginRight: '6px' }}>●</span>
            {p.isHost ? '👑 ' : ''}{p.name}
            {!p.online && <span style={{ fontSize: '0.75rem', marginLeft: '6px' }}>（離線）</span>}
            {p.id === view.me.id && <span className="text-cyan" style={{ fontSize: '0.8rem', marginLeft: '6px' }}>（你）</span>}
          </span>
          {view.me.isHost && p.id !== view.me.id && (
            <button onClick={() => onKick(p.id)} className="btn-ghost" style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              移出
            </button>
          )}
        </div>
      ))}
    </div>
    {onAddBot && view.me.isHost && view.phase === 'LOBBY' && (
      <>
        <button onClick={onAddBot} className="btn btn-secondary btn-full" style={{ marginTop: '10px' }}>
          🤖 加入電腦玩家
        </button>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.78rem', marginTop: '6px', textAlign: 'center' }}>
          人數不夠時用電腦補位，由這支手機代為操作，不會發言
        </p>
      </>
    )}
  </div>
);
