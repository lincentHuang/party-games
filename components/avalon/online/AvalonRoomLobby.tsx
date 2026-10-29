'use client';

import React from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { ALIGNMENT_COUNT_BY_PLAYERS, QUEST_CONFIG_BY_PLAYERS, ROLE_INFO } from '@/lib/avalonRules';
import { AVALON_MAX_PLAYERS, AVALON_MIN_PLAYERS, resolveRoles } from '@/lib/avalonEngine';
import { soundManager } from '@/lib/soundManager';
import { AvalonRole } from '@/types/avalon';
import { AvalonAction, AvalonRoomConfig, AvalonRoomView } from '@/types/avalonRoom';

interface AvalonRoomLobbyProps {
  view: AvalonRoomView;
  isBusy: boolean;
  onAct: (action: AvalonAction) => Promise<boolean>;
  onLeave: () => void;
}

type RoleToggle = { key: 'usePercival' | 'useMorgana' | 'useMordred' | 'useOberon'; role: AvalonRole; hint: string };

const ROLE_TOGGLES: RoleToggle[] = [
  { key: 'usePercival', role: 'PERCIVAL', hint: '看得到梅林與莫甘娜，但分不出誰是誰' },
  { key: 'useMorgana', role: 'MORGANA', hint: '在派西維爾眼中偽裝成梅林' },
  { key: 'useMordred', role: 'MORDRED', hint: '梅林看不到他' },
  { key: 'useOberon', role: 'OBERON', hint: '不認識壞人同伴，同伴也不認識他' }
];

export const AvalonRoomLobby: React.FC<AvalonRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  // 人數不足時用 5 人預覽
  const previewCount = Math.min(Math.max(playerCount, AVALON_MIN_PLAYERS), AVALON_MAX_PLAYERS);
  const align = ALIGNMENT_COUNT_BY_PLAYERS[previewCount];
  const quests = QUEST_CONFIG_BY_PLAYERS[previewCount];
  const roles = resolveRoles(previewCount, config);

  const updateConfig = (patch: Partial<AvalonRoomConfig>) => {
    soundManager.playClick();
    onAct({ action: 'UPDATE_CONFIG', config: patch });
  };

  const handleStart = () => {
    soundManager.playClick();
    onAct({ action: 'START' });
  };

  const missing = Math.max(0, AVALON_MIN_PLAYERS - playerCount);
  const countLabel = (list: AvalonRole[]) => {
    const counts: Partial<Record<AvalonRole, number>> = {};
    list.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    return (Object.keys(counts) as AvalonRole[]).map(r => `${ROLE_INFO[r].name}${counts[r]! > 1 ? `×${counts[r]}` : ''}`).join('、');
  };

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="avalon" />
      {view.lastNotice && (
        <div className="shrink-0 mb-md" style={{ padding: '10px 12px', borderRadius: 'var(--radius-inner)', background: 'rgba(250, 204, 21, 0.12)', color: 'var(--accent-yellow)', fontSize: '0.88rem' }}>
          ⚠️ {view.lastNotice}
        </div>
      )}
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} />

      {/* 人數配置預覽 */}
      <div className="card shrink-0 mb-md" style={{ padding: '14px 16px' }}>
        <div className="flex-between mb-sm">
          <span style={{ fontWeight: 800, color: '#ffffff' }}>{playerCount < AVALON_MIN_PLAYERS ? '5 人局配置（預覽）' : `${playerCount} 人局配置`}</span>
          <span className="text-code" style={{ fontWeight: 800 }}>
            <span style={{ color: '#60a5fa' }}>好人 {align.good}</span> / <span style={{ color: '#f87171' }}>壞人 {align.evil}</span>
          </span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', marginBottom: '8px' }}>
          <div>⚔️ {countLabel(roles.good)}</div>
          <div>🗡️ {countLabel(roles.evil)}</div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '6px' }}>每輪任務人數</div>
        <div className="quest-track">
          {quests.map((n, i) => (
            <div key={i} className="quest-node">
              <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>第 {i + 1} 輪</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>{n}</span>
              {previewCount >= 7 && i === 3 && <span style={{ fontSize: '0.64rem', color: 'var(--accent-yellow)' }}>需2張失敗</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 角色與規則設定 */}
      <div className="flex-col gap-md shrink-0 mb-md">
        {ROLE_TOGGLES.map(t => {
          const info = ROLE_INFO[t.role];
          const pool = info.alignment === 'GOOD' ? roles.good : roles.evil;
          const enabled = config[t.key];
          const dropped = enabled && !pool.includes(t.role); // 開了但名額不夠
          return (
            <div key={t.key} className="toggle-row">
              <div>
                <div style={{ fontWeight: 800, color: '#ffffff' }}>{info.icon} {info.name}</div>
                <div style={{ fontSize: '0.8rem', color: dropped ? 'var(--accent-yellow)' : 'var(--fg-secondary)' }}>
                  {dropped ? `壞人名額不足，這個角色這局不會出現` : t.hint}
                </div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" disabled={!isHost} checked={enabled} onChange={e => updateConfig({ [t.key]: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
          );
        })}
        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>🧜‍♀️ 湖中仙女</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>第 2、3、4 輪後查驗一位玩家的陣營（7 人以上建議開）</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" disabled={!isHost} checked={config.useLady ?? false} onChange={e => updateConfig({ useLady: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
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
