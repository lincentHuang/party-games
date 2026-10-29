'use client';

import React, { useMemo } from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
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

export const SpyRoomLobby: React.FC<SpyRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  const maxSpies = maxSpiesFor(Math.max(playerCount, SPY_MIN_PLAYERS), config.hasBlank);
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

  const handleStart = () => {
    soundManager.playClick();
    onAct({ action: 'START', customWords: wordManagerInstance.getCustomWords() });
  };

  const missing = Math.max(0, SPY_MIN_PLAYERS - playerCount);

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="spy" />
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} />

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
