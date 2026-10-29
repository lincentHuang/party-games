'use client';

import React from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { soundManager } from '@/lib/soundManager';
import { CODEWORD_MAX_PLAYERS, CODEWORD_MIN_PLAYERS } from '@/lib/codewordEngine';
import { CodewordAction, CodewordRoomView, CodewordTeam } from '@/types/codewordRoom';
import { TEAM_INFO } from './codewordShared';

interface CodewordRoomLobbyProps {
  view: CodewordRoomView;
  isBusy: boolean;
  onAct: (action: CodewordAction) => Promise<boolean>;
  onLeave: () => void;
}

const CLUE_TIMES = [0, 60, 90, 120];
const TEAMS: CodewordTeam[] = ['RED', 'BLUE'];

export const CodewordRoomLobby: React.FC<CodewordRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const meId = view.me.id;
  const press = (action: CodewordAction) => {
    soundManager.playClick();
    onAct(action);
  };

  // 開局條件檢查（和規則引擎一致）
  let problem = '';
  if (view.members.length < CODEWORD_MIN_PLAYERS) problem = `還差 ${CODEWORD_MIN_PLAYERS - view.members.length} 人才能開始（${CODEWORD_MIN_PLAYERS}–${CODEWORD_MAX_PLAYERS} 人）`;
  else {
    for (const t of TEAMS) {
      const list = view.members.filter(m => m.team === t);
      if (list.length < 2) { problem = `${TEAM_INFO[t].name}至少要 2 人`; break; }
      if (!list.some(m => !m.isBot)) { problem = `${TEAM_INFO[t].name}至少要有 1 位真人當隊長`; break; }
    }
  }

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="codeword" />
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} onAddBot={() => onAct({ action: 'ADD_BOT' })} />

      <div className="flex-col gap-md shrink-0 mb-md">
        {isHost && (
          <button onClick={() => press({ action: 'SHUFFLE_TEAMS' })} className="btn btn-secondary btn-full">🎲 隨機分隊</button>
        )}

        {TEAMS.map(t => {
          const info = TEAM_INFO[t];
          const list = view.members.filter(m => m.team === t);
          const captain = list.find(m => m.isCaptain);
          const meIn = view.myTeam === t;
          return (
            <div key={t} className="card" style={{ padding: '14px', borderColor: info.color }}>
              <div className="flex-between" style={{ marginBottom: '8px' }}>
                <span style={{ fontWeight: 900, color: info.color, fontSize: '1.05rem' }}>{info.emoji} {info.name}（{list.length} 人）</span>
                {!meIn && (
                  <button onClick={() => press({ action: 'SET_TEAM', team: t })} className="chip-btn" disabled={isBusy}>加入</button>
                )}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: '8px' }}>
                隊長：{captain ? `👑 ${captain.name}` : '尚未選出（開局時會從真人中隨機指定）'}
              </div>
              <div className="flex-col gap-sm">
                {list.length === 0 && <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>還沒有人</div>}
                {list.map(m => (
                  <div key={m.playerId} className="flex-between" style={{ padding: '8px 10px', borderRadius: 'var(--radius-inner)', background: 'var(--bg-elevated)', gap: '6px' }}>
                    <span style={{ color: m.online ? '#ffffff' : 'var(--fg-muted)', fontWeight: 700 }}>
                      {m.isCaptain ? '👑 ' : ''}{m.name}
                      {m.playerId === meId && <span className="text-cyan" style={{ fontSize: '0.8rem', marginLeft: '6px' }}>（你）</span>}
                    </span>
                    <span style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {!m.isBot && (m.playerId === meId || isHost) && (
                        <button
                          onClick={() => press(m.playerId === meId ? { action: 'SET_CAPTAIN' } : { action: 'SET_CAPTAIN', targetId: m.playerId })}
                          className={`chip-btn ${m.isCaptain ? 'active' : ''}`}
                          disabled={isBusy}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          {m.isCaptain ? (m.playerId === meId ? '放棄隊長' : '隊長') : m.playerId === meId ? '我當隊長' : '設為隊長'}
                        </button>
                      )}
                      {isHost && m.playerId !== meId && (
                        <button
                          onClick={() => press({ action: 'SET_TEAM', team: t === 'RED' ? 'BLUE' : 'RED', targetId: m.playerId })}
                          className="chip-btn"
                          disabled={isBusy}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          換隊
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '4px' }}>隊長出題時間</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)', marginBottom: '8px' }}>只顯示倒數提醒，時間到不會強制換人</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {CLUE_TIMES.map(t => (
              <button key={t} disabled={!isHost} onClick={() => press({ action: 'UPDATE_CONFIG', config: { clueTime: t } })} className={`chip-btn ${view.config.clueTime === t ? 'active' : ''}`}>
                {t === 0 ? '不限時' : `${t} 秒`}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--fg-secondary)', lineHeight: 1.6 }}>
          📖 5×5 共 25 個詞：先手隊 9 張、後手隊 8 張、平民 7 張、刺客 1 張。隊長給「一個詞＋數字」，隊員猜出自己隊的牌；翻到刺客立刻輸，先翻完自己隊所有牌的隊伍獲勝。電腦只能當隊員。
        </div>
      </div>

      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button onClick={() => press({ action: 'START' })} disabled={!!problem || isBusy} className="btn btn-primary btn-large btn-full">
            {problem || `🕵️ ${view.members.length} 人開始遊戲`}
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '12px 0' }}>
            {problem ? `⏳ ${problem}` : '⏳ 等待房主開始遊戲…'}
          </div>
        )}
        <button onClick={onLeave} className="btn btn-ghost btn-full" style={{ color: 'var(--fg-muted)' }}>離開房間</button>
      </div>
    </div>
  );
};
