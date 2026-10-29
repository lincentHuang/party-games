'use client';

import React from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { soundManager } from '@/lib/soundManager';
import {
  godCountOf,
  maxWolvesFor,
  villagerCountFor,
  WEREWOLF_MAX_PLAYERS,
  WEREWOLF_MIN_PLAYERS
} from '@/lib/werewolfEngine';
import { WerewolfAction, WerewolfConfig, WerewolfRoomView } from '@/types/werewolfRoom';
import { ROLE_INFO } from './werewolfShared';

interface WerewolfRoomLobbyProps {
  view: WerewolfRoomView;
  isBusy: boolean;
  onAct: (action: WerewolfAction) => Promise<boolean>;
  onLeave: () => void;
}

const SPEECH_TIMES = [0, 30, 45, 60, 90];
const GOD_TOGGLES = [
  { key: 'seer', role: 'SEER' },
  { key: 'witch', role: 'WITCH' },
  { key: 'hunter', role: 'HUNTER' },
  { key: 'guard', role: 'GUARD' }
] as const;

export const WerewolfRoomLobby: React.FC<WerewolfRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  const maxWolves = maxWolvesFor(playerCount);
  const wolves = Math.min(config.wolfCount, maxWolves);
  const villagers = villagerCountFor(playerCount, { ...config, wolfCount: wolves });

  const updateConfig = (patch: Partial<WerewolfConfig>) => {
    soundManager.playClick();
    onAct({ action: 'UPDATE_CONFIG', config: patch });
  };

  const missing = Math.max(0, WEREWOLF_MIN_PLAYERS - playerCount);
  const invalid = missing === 0 && villagers < 1;
  const summary = [
    `${wolves} 狼人`,
    ...GOD_TOGGLES.filter(g => config[g.key]).map(g => ROLE_INFO[g.role].name),
    `${Math.max(0, villagers)} 平民`
  ].join('・');

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="werewolf" />
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} />

      <div className="flex-col gap-md shrink-0 mb-md">
        <div className="card text-center" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
            本局配置（{playerCount} 人）{config.auto ? '・依人數自動' : '・手動調整'}
          </div>
          <div style={{ color: invalid ? 'var(--accent-magenta)' : '#ffffff', fontWeight: 800, marginTop: '4px' }}>{summary}</div>
          {invalid && <div style={{ color: 'var(--accent-magenta)', fontSize: '0.8rem', marginTop: '4px' }}>神職太多，至少要留 1 位平民</div>}
          {isHost && !config.auto && (
            <button onClick={() => updateConfig({ auto: true })} className="btn btn-ghost" style={{ fontSize: '0.8rem', marginTop: '6px', color: 'var(--accent-cyan-light)' }}>
              ↺ 套用 {playerCount} 人的建議配置
            </button>
          )}
        </div>

        <div className="stepper-container">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>狼人人數</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>狼人要少於好人，目前最多 {maxWolves} 位</div>
          </div>
          <div className="stepper-controls">
            <button className="stepper-btn" disabled={!isHost || wolves <= 1} onClick={() => updateConfig({ wolfCount: wolves - 1 })}>-</button>
            <span className="stepper-val text-magenta">{wolves}</span>
            <button className="stepper-btn" disabled={!isHost || wolves >= maxWolves} onClick={() => updateConfig({ wolfCount: wolves + 1 })}>+</button>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>神職（共 {godCountOf(config)} 位）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {GOD_TOGGLES.map(g => (
              <button key={g.key} disabled={!isHost} onClick={() => updateConfig({ [g.key]: !config[g.key] })} className={`chip-btn ${config[g.key] ? 'active' : ''}`}>
                {ROLE_INFO[g.role].emoji} {ROLE_INFO[g.role].name}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>勝利條件</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button disabled={!isHost} onClick={() => updateConfig({ winMode: 'SIDE' })} className={`chip-btn ${config.winMode === 'SIDE' ? 'active' : ''}`}>屠邊</button>
            <button disabled={!isHost} onClick={() => updateConfig({ winMode: 'CITY' })} className={`chip-btn ${config.winMode === 'CITY' ? 'active' : ''}`}>屠城</button>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)', marginTop: '8px' }}>
            {config.winMode === 'SIDE'
              ? '屠邊：神職全死或平民全死，狼人就贏；狼人全死好人贏'
              : '屠城：好人全部死光狼人才贏；狼人全死好人贏'}
          </div>
        </div>

        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>出局時公開身分</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>關掉的話，要等整局結束才知道誰是什麼身分</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" disabled={!isHost} checked={config.showRoleOnDeath} onChange={e => updateConfig({ showRoleOnDeath: e.target.checked })} />
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
      </div>

      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button
            onClick={() => { soundManager.playClick(); onAct({ action: 'START' }); }}
            disabled={missing > 0 || invalid || isBusy}
            className="btn btn-primary btn-large btn-full"
          >
            {missing > 0 ? `還差 ${missing} 人才能開始（${WEREWOLF_MIN_PLAYERS}–${WEREWOLF_MAX_PLAYERS} 人）` : `🌙 ${playerCount} 人開始遊戲`}
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '12px 0' }}>⏳ 等待房主開始遊戲…</div>
        )}
        <button onClick={onLeave} className="btn btn-ghost btn-full" style={{ color: 'var(--fg-muted)' }}>離開房間</button>
      </div>
    </div>
  );
};
