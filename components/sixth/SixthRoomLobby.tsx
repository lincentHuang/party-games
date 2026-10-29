'use client';

import React from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { soundManager } from '@/lib/soundManager';
import {
  SIXTH_HAND_SIZE,
  SIXTH_LIMITS,
  SIXTH_MAX_PLAYERS,
  SIXTH_MIN_PLAYERS,
  SIXTH_NORMAL_DECK,
  SIXTH_ROW_COUNT,
  SixthAction,
  SixthConfig,
  SixthRoomView
} from '@/types/sixthRoom';

interface SixthRoomLobbyProps {
  view: SixthRoomView;
  isBusy: boolean;
  onAct: (action: SixthAction) => Promise<boolean>;
  onLeave: () => void;
}

export const SixthRoomLobby: React.FC<SixthRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const config = view.config;
  const playerCount = view.players.length;
  const missing = Math.max(0, SIXTH_MIN_PLAYERS - playerCount);
  const deckSize = config.expert ? playerCount * SIXTH_HAND_SIZE + SIXTH_ROW_COUNT : SIXTH_NORMAL_DECK;

  const updateConfig = (patch: Partial<SixthConfig>) => {
    soundManager.playClick();
    onAct({ action: 'UPDATE_CONFIG', config: patch });
  };

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="sixth" />
      <RoomPlayerList view={view} onKick={id => onAct({ action: 'KICK', targetId: id })} onAddBot={() => onAct({ action: 'ADD_BOT' })} />

      <div className="flex-col gap-md shrink-0 mb-md">
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>玩法</div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--fg-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
            <li>每人 {SIXTH_HAND_SIZE} 張牌，桌上 {SIXTH_ROW_COUNT} 列各 1 張起始牌</li>
            <li>每輪大家同時選 1 張，全員送出後由小到大擺放</li>
            <li>牌接在「列尾比它小、且差距最小」的那列；那列已有 5 張，你就吃掉 5 張</li>
            <li>比所有列尾都小：自己選一列整列吃掉</li>
            <li>吃到的牌上有💣，累計最少的人獲勝</li>
          </ul>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>結束條件：任何人累計炸彈達到</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SIXTH_LIMITS.map(l => (
              <button key={l} disabled={!isHost} onClick={() => updateConfig({ limit: l })} className={`chip-btn ${config.limit === l ? 'active' : ''}`}>
                💣 {l}
              </button>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>專家模式</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
              只用 1 到 {playerCount * SIXTH_HAND_SIZE + SIXTH_ROW_COUNT} 的牌（人數×10+4 張），牌更密、更容易撞列
            </div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" disabled={!isHost} checked={config.expert} onChange={e => updateConfig({ expert: e.target.checked })} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="card text-center" style={{ padding: '10px 16px', fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
          {playerCount} 人 · 牌庫 {deckSize} 張 · 炸彈：尾數 0 → 3、尾數 5 → 2、雙數字（11、22…）→ 5、77 → 7、其他 1
        </div>
      </div>

      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button
            onClick={() => { soundManager.playClick(); onAct({ action: 'START' }); }}
            disabled={missing > 0 || isBusy}
            className="btn btn-primary btn-large btn-full"
          >
            {missing > 0 ? `還差 ${missing} 人才能開始（${SIXTH_MIN_PLAYERS}–${SIXTH_MAX_PLAYERS} 人）` : `💥 ${playerCount} 人開始遊戲`}
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '12px 0' }}>⏳ 等待房主開始遊戲…</div>
        )}
        <button onClick={onLeave} className="btn btn-ghost btn-full" style={{ color: 'var(--fg-muted)' }}>離開房間</button>
      </div>
    </div>
  );
};
