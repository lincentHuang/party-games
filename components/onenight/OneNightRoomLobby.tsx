'use client';

import React from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { soundManager } from '@/lib/soundManager';
import {
  deckSummary,
  MAX_WOLVES,
  ONENIGHT_MAX_PLAYERS,
  ONENIGHT_MIN_PLAYERS,
  TOGGLE_KEYS,
  TOGGLE_ROLE
} from '@/lib/oneNightEngine';
import { OneNightAction, OneNightConfig, OneNightRoomView } from '@/types/oneNightRoom';
import { ROLE_INFO } from './onenightShared';

interface OneNightRoomLobbyProps {
  view: OneNightRoomView;
  isBusy: boolean;
  onAct: (action: OneNightAction) => Promise<boolean>;
  onLeave: () => void;
}

const DAY_MINUTES = [3, 5, 7, 0];

export const OneNightRoomLobby: React.FC<OneNightRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  const calcCount = Math.max(playerCount, ONENIGHT_MIN_PLAYERS);
  const summary = deckSummary(config, calcCount);
  const missing = Math.max(0, ONENIGHT_MIN_PLAYERS - playerCount);
  const invalid = summary.invalid;

  const updateConfig = (patch: Partial<OneNightConfig>) => {
    soundManager.playClick();
    onAct({ action: 'UPDATE_CONFIG', config: patch });
  };

  const summaryText = summary.roles.map(([role, count]) => `${ROLE_INFO[role].name}${count > 1 ? `×${count}` : ''}`).join('・');

  return (
    <div className="view-container view-enter">
      {view.notice && (
        <div className="card text-center shrink-0 mb-md" style={{ padding: '10px 14px', borderColor: 'rgba(250, 204, 21, 0.4)', color: 'var(--accent-yellow)', fontSize: '0.88rem' }}>
          ⚠️ {view.notice}
        </div>
      )}
      <RoomInviteCard view={view} gameParam="onenight" />
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} onAddBot={() => onAct({ action: 'ADD_BOT' })} />

      <div className="flex-col gap-md shrink-0 mb-md">
        <div className="card text-center" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
            本局配置（{calcCount} 人・{summary.total} 張牌，3 張放中央）{config.auto ? '・依人數自動' : '・手動調整'}
          </div>
          <div style={{ color: invalid ? 'var(--accent-magenta)' : '#ffffff', fontWeight: 800, marginTop: '4px' }}>{summaryText}</div>
          <div style={{ fontSize: '0.8rem', marginTop: '4px', color: invalid ? 'var(--accent-magenta)' : 'var(--fg-secondary)' }}>
            {invalid
              ? `特殊角色 ${summary.special} 張，超過牌數 ${summary.total} 張，請減少一些`
              : `特殊角色 ${summary.special} 張，村民補 ${summary.villagers} 張`}
          </div>
          {isHost && !config.auto && (
            <button onClick={() => updateConfig({ auto: true })} className="btn btn-ghost" style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--accent-cyan-light)' }}>
              ↺ 套用 {calcCount} 人的建議配置
            </button>
          )}
        </div>

        <div className="stepper-container">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>狼人牌張數</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>狼人牌可能落在中央，場上不一定有狼</div>
          </div>
          <div className="stepper-controls">
            <button className="stepper-btn" disabled={!isHost || config.wolfCount <= 1} onClick={() => updateConfig({ wolfCount: config.wolfCount - 1 })}>-</button>
            <span className="stepper-val text-magenta">{config.wolfCount}</span>
            <button className="stepper-btn" disabled={!isHost || config.wolfCount >= MAX_WOLVES} onClick={() => updateConfig({ wolfCount: config.wolfCount + 1 })}>+</button>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>其他角色（各 1 張，點選開關）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {TOGGLE_KEYS.map(k => (
              <button key={k} disabled={!isHost} onClick={() => updateConfig({ [k]: !config[k] })} className={`chip-btn ${config[k] ? 'active' : ''}`}>
                {ROLE_INFO[TOGGLE_ROLE[k]].emoji} {ROLE_INFO[TOGGLE_ROLE[k]].name}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)', marginTop: '8px' }}>不夠的牌會用村民補滿，牌數永遠等於人數 + 3。</div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>白天討論時間</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {DAY_MINUTES.map(m => (
              <button key={m} disabled={!isHost} onClick={() => updateConfig({ dayMinutes: m })} className={`chip-btn ${config.dayMinutes === m ? 'active' : ''}`}>
                {m === 0 ? '不限時' : `${m} 分鐘`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button
            onClick={() => { soundManager.playClick(); onAct({ action: 'START' }); }}
            disabled={missing > 0 || invalid || isBusy}
            className="btn btn-primary btn-large btn-full"
          >
            {missing > 0 ? `還差 ${missing} 人才能開始（${ONENIGHT_MIN_PLAYERS}–${ONENIGHT_MAX_PLAYERS} 人）` : `🌙 ${playerCount} 人開始遊戲`}
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '12px 0' }}>⏳ 等待房主開始遊戲…</div>
        )}
        <button onClick={onLeave} className="btn btn-ghost btn-full" style={{ color: 'var(--fg-muted)' }}>離開房間</button>
      </div>
    </div>
  );
};
