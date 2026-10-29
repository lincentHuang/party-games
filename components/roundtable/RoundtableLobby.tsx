'use client';

import React, { useState } from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { ALIGNMENT_COUNT_BY_PLAYERS, QUEST_CONFIG_BY_PLAYERS } from '@/lib/avalonRules';
import { RT_MAX_PLAYERS, RT_MIN_PLAYERS, resolveRtRoles } from '@/lib/roundtableEngine';
import { soundManager } from '@/lib/soundManager';
import { RoundtableAction, RoundtableRoomView, RtResolvedConfig, RtRole } from '@/types/roundtableRoom';
import { RT_ROLE_INFO } from './roundtableShared';

interface RoundtableLobbyProps {
  view: RoundtableRoomView;
  isBusy: boolean;
  onAct: (action: RoundtableAction) => Promise<boolean>;
  onLeave: () => void;
}

type Toggle = { key: keyof RtResolvedConfig; icon: string; title: string; hint: string };

const TOGGLES: Toggle[] = [
  { key: 'guard', icon: '🛡️', title: '守衛', hint: '每晚守護一人，擋掉狼刀（預設 6 人以上開）' },
  { key: 'hunter', icon: '🏹', title: '獵人', hint: '夜裡被狼殺死時可開槍帶走一人（預設 8 人以上開）' },
  { key: 'hiddenWolf', icon: '🌑', title: '隱狼', hint: '佔一個狼人名額，預言家查驗他會顯示「好人」（預設 7 人以上開）' },
  { key: 'revealOnDeath', icon: '🪦', title: '出局時公開身分', hint: '陣亡的人角色會公開給所有人（預設關）' }
];

const HOW_TO_PLAY = [
  '☀️ 白天像阿瓦隆：隊長選人出任務，全員（含陣亡的亡魂）表決，贊成要多於反對。好人只能出成功牌，狼人可以出失敗。',
  '🌙 夜晚像狼人殺：只有「任務成功」的那一晚，狼人才能一起殺一個人；任務失敗的夜晚狼人按兵不動。預言家查驗、守衛守護，其他人做夜間推理。',
  '🔮 預言家每晚查驗一人（隱狼會顯示好人）；🛡️ 守衛擋刀；🏹 獵人夜裡被殺可以帶走一人。陣亡的人不能當隊長、不能出任務，但仍可表決，請不要發言。',
  '🏆 好人：三次任務成功。但若預言家還活著，狼人有「最後獵殺」一次機會猜他是誰，猜中就逆轉；狼人全滅則好人立刻獲勝。',
  '🐺 狼人：三次任務失敗、連續五次組隊被否決、或最後獵殺猜中預言家。',
  '🎯 策略：夜裡先殺掉疑似預言家，能斷掉好人情報，也讓三勝時好人直接獲勝；但殺錯人就浪費了這一刀。'
];

export const RoundtableLobby: React.FC<RoundtableLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  const previewCount = Math.min(Math.max(playerCount, RT_MIN_PLAYERS), RT_MAX_PLAYERS);
  const align = ALIGNMENT_COUNT_BY_PLAYERS[previewCount];
  const quests = QUEST_CONFIG_BY_PLAYERS[previewCount];
  const roles = resolveRtRoles(previewCount, config);
  const [showRules, setShowRules] = useState(false);

  const updateConfig = (patch: Partial<RtResolvedConfig>) => {
    soundManager.playClick();
    onAct({ action: 'UPDATE_CONFIG', config: patch });
  };

  const missing = Math.max(0, RT_MIN_PLAYERS - playerCount);
  const countLabel = (list: RtRole[]) => {
    const counts: Partial<Record<RtRole, number>> = {};
    list.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    return (Object.keys(counts) as RtRole[]).map(r => `${RT_ROLE_INFO[r].name}${counts[r]! > 1 ? `×${counts[r]}` : ''}`).join('、');
  };

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="roundtable" />
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} onAddBot={() => onAct({ action: 'ADD_BOT' })} />

      {/* 怎麼玩 */}
      <div className="card shrink-0 mb-md" style={{ padding: '12px 16px' }}>
        <button
          onClick={() => { soundManager.playClick(); setShowRules(v => !v); }}
          className="flex-between"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', fontWeight: 800, fontSize: '1rem', padding: 0 }}
        >
          <span>📖 怎麼玩</span>
          <span style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>{showRules ? '收起 ▲' : '展開 ▼'}</span>
        </button>
        {showRules && (
          <div className="flex-col gap-sm" style={{ marginTop: '10px' }}>
            {HOW_TO_PLAY.map((line, i) => (
              <p key={i} style={{ color: 'var(--fg-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.55 }}>{line}</p>
            ))}
          </div>
        )}
      </div>

      {/* 人數配置預覽 */}
      <div className="card shrink-0 mb-md" style={{ padding: '14px 16px' }}>
        <div className="flex-between mb-sm">
          <span style={{ fontWeight: 800, color: '#ffffff' }}>{playerCount < RT_MIN_PLAYERS ? '5 人局配置（預覽）' : `${playerCount} 人局配置`}</span>
          <span className="text-code" style={{ fontWeight: 800 }}>
            <span style={{ color: '#60a5fa' }}>好人 {align.good}</span> / <span style={{ color: '#f87171' }}>狼人陣營 {align.evil}</span>
          </span>
        </div>
        {roles ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', marginBottom: '8px' }}>
            <div>⚔️ {countLabel(roles.good)}</div>
            <div>🐺 {countLabel(roles.evil)}</div>
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--accent-yellow)', marginBottom: '8px' }}>⚠️ 神職加起來超過好人名額，請關掉守衛或獵人</div>
        )}
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
        {TOGGLES.map(t => (
          <div key={t.key} className="toggle-row">
            <div>
              <div style={{ fontWeight: 800, color: '#ffffff' }}>{t.icon} {t.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>{t.hint}</div>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" disabled={!isHost} checked={config[t.key]} onChange={e => updateConfig({ [t.key]: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}
        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>🔮 預言家一定會出現。神職加起來不能超過好人名額。</div>
      </div>

      {/* 開始／等待 */}
      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button onClick={() => { soundManager.playClick(); onAct({ action: 'START' }); }} disabled={missing > 0 || isBusy || !roles} className="btn btn-primary btn-large btn-full">
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
