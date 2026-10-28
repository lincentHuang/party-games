'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { soundManager } from '@/lib/soundManager';
import { wordManagerInstance } from '@/lib/wordManager';
import { maxSpiesFor, SPY_MIN_PLAYERS } from '@/lib/spyEngine';
import { Difficulty } from '@/types/game';
import { SpyAction, SpyRoomConfig, SpyRoomView } from '@/types/spyRoom';

interface SpyRoomLobbyProps {
  view: SpyRoomView;
  isBusy: boolean;
  onAct: (action: SpyAction) => Promise<boolean>;
  onLeave: () => void;
}

const SPEECH_TIMES = [0, 30, 45, 60, 90];
const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: '🟢 簡單', medium: '🟡 中等', hard: '🔴 困難' };

// 本機開發時手機連不到 localhost，改用電腦的區網 IP；部署後直接用目前網址
function useJoinUrl(roomId: string) {
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
  return `${origin}/?game=spy&room=${roomId}`;
}

export const SpyRoomLobby: React.FC<SpyRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  const maxSpies = maxSpiesFor(Math.max(playerCount, SPY_MIN_PLAYERS), config.hasBlank);
  const joinUrl = useJoinUrl(view.roomId);
  const [copied, setCopied] = useState(false);
  const categories = useMemo(() => wordManagerInstance.getCategories(), []);

  const updateConfig = (patch: Partial<SpyRoomConfig>) => {
    soundManager.playClick();
    onAct({ action: 'UPDATE_CONFIG', config: patch });
  };

  const toggleDifficulty = (d: Difficulty) => {
    const has = config.difficulties.includes(d);
    if (has && config.difficulties.length === 1) return;
    updateConfig({ difficulties: has ? config.difficulties.filter(x => x !== d) : [...config.difficulties, d] });
  };

  const toggleCategory = (c: string) => {
    if (c === 'all') return updateConfig({ categories: ['all'] });
    const current = config.categories.filter(x => x !== 'all');
    const next = current.includes(c) ? current.filter(x => x !== c) : [...current, c];
    updateConfig({ categories: next.length > 0 ? next : ['all'] });
  };

  const handleCopy = () => {
    soundManager.playClick();
    navigator.clipboard?.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = () => {
    soundManager.playClick();
    onAct({ action: 'START', customWords: wordManagerInstance.getCustomWords() });
  };

  const missing = Math.max(0, SPY_MIN_PLAYERS - playerCount);

  return (
    <div className="view-container view-enter">
      {/* 房號與 QR Code */}
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
        {isHost && (
          <p style={{ color: 'var(--accent-yellow)', fontSize: '0.8rem', margin: '0 0 8px' }}>
            ⚠️ 你的手機就是這場遊戲的主機，請保持這個畫面開著、不要鎖螢幕
          </p>
        )}
        <button onClick={handleCopy} className="btn btn-secondary btn-full" style={{ fontSize: '0.85rem', padding: '8px 14px' }}>
          {copied ? '✅ 已複製邀請連結' : '📋 複製邀請連結'}
        </button>
      </div>

      {/* 玩家名單 */}
      <div className="card shrink-0 mb-md" style={{ padding: '14px' }}>
        <div className="flex-between mb-sm">
          <span style={{ fontWeight: 800, color: 'var(--fg-pure)' }}>👥 已加入 {playerCount} 人</span>
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
              {isHost && p.id !== view.me.id && (
                <button
                  onClick={() => onAct({ action: 'KICK', targetId: p.id })}
                  className="btn-ghost"
                  style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}
                >
                  移出
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 遊戲設定 */}
      <div className="flex-col gap-md shrink-0 mb-md">
        <div className="stepper-container">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>間諜人數</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>目前人數最多 {maxSpies} 位</div>
          </div>
          <div className="stepper-controls">
            <button className="stepper-btn" disabled={!isHost || config.spyCount <= 1} onClick={() => updateConfig({ spyCount: config.spyCount - 1 })}>-</button>
            <span className="stepper-val text-magenta">{Math.min(config.spyCount, maxSpies)}</span>
            <button className="stepper-btn" disabled={!isHost || config.spyCount >= maxSpies} onClick={() => updateConfig({ spyCount: config.spyCount + 1 })}>+</button>
          </div>
        </div>

        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>加入白板</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-yellow)' }}>1 位玩家沒有詞，只能靠聽別人描述</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" disabled={!isHost} checked={config.hasBlank} onChange={e => updateConfig({ hasBlank: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>出局時公開身分</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>關掉的話，要等整局結束才知道誰是間諜</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" disabled={!isHost} checked={config.showRoleOnEliminated} onChange={e => updateConfig({ showRoleOnEliminated: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>每人發言時間</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SPEECH_TIMES.map(t => (
              <button key={t} disabled={!isHost} onClick={() => updateConfig({ speechTime: t })} className={`chip-btn ${config.speechTime === t ? 'active' : ''}`}>
                {t === 0 ? '不限時' : `${t} 秒`}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>題目難度</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map(d => (
              <button key={d} disabled={!isHost} onClick={() => toggleDifficulty(d)} className={`chip-btn chip-${d} ${config.difficulties.includes(d) ? 'active' : ''}`}>
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 800, color: '#ffffff', margin: '14px 0 8px' }}>題目分類</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button disabled={!isHost} onClick={() => toggleCategory('all')} className={`chip-btn ${config.categories.includes('all') ? 'active' : ''}`}>全部</button>
            {categories.map(c => (
              <button key={c} disabled={!isHost} onClick={() => toggleCategory(c)} className={`chip-btn ${config.categories.includes(c) ? 'active' : ''}`}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* 開始／等待 */}
      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button onClick={handleStart} disabled={missing > 0 || isBusy} className="btn btn-primary btn-large btn-full">
            {missing > 0 ? `還差 ${missing} 人才能開始` : `🚀 ${playerCount} 人開始遊戲`}
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '12px 0' }}>⏳ 等待房主開始遊戲…</div>
        )}
        <button onClick={onLeave} className="btn btn-ghost btn-full" style={{ color: 'var(--fg-muted)' }}>離開房間</button>
      </div>
    </div>
  );
};
