'use client';

import React from 'react';
import { RoomInviteCard, RoomPlayerList } from '@/components/room/RoomInviteCard';
import { soundManager } from '@/lib/soundManager';
import { PLOT_MAX_PLAYERS, PLOT_MIN_PLAYERS } from '@/lib/plotEngine';
import { PlotAction, PlotRoomView } from '@/types/plotRoom';
import { CheatSheet } from './plotShared';

interface PlotRoomLobbyProps {
  view: PlotRoomView;
  isBusy: boolean;
  onAct: (action: PlotAction) => Promise<boolean>;
  onLeave: () => void;
}

export const PlotRoomLobby: React.FC<PlotRoomLobbyProps> = ({ view, isBusy, onAct, onLeave }) => {
  const isHost = view.me.isHost;
  const playerCount = view.players.length;
  const missing = Math.max(0, PLOT_MIN_PLAYERS - playerCount);
  const full = playerCount >= PLOT_MAX_PLAYERS;

  return (
    <div className="view-container view-enter">
      <RoomInviteCard view={view} gameParam="plot" />
      <RoomPlayerList
        view={view}
        onKick={id => onAct({ action: 'KICK', targetId: id })}
        onAddBot={full ? undefined : () => onAct({ action: 'ADD_BOT' })}
      />

      <div className="card text-center shrink-0 mb-md" style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 800, color: '#ffffff' }}>牌庫：5 種角色各 3 張（共 15 張）</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', marginTop: '6px' }}>
          每人 2 張暗牌、2 枚金幣。輪到你就選一個行動，可以誠實，也可以吹牛。
        </div>
      </div>

      <CheatSheet />

      <div className="flex-col gap-sm shrink-0 mt-auto" style={{ paddingBottom: '16px' }}>
        {isHost ? (
          <button
            onClick={() => { soundManager.playClick(); onAct({ action: 'START' }); }}
            disabled={missing > 0 || isBusy}
            className="btn btn-primary btn-large btn-full"
          >
            {missing > 0 ? `還差 ${missing} 人才能開始（${PLOT_MIN_PLAYERS}–${PLOT_MAX_PLAYERS} 人）` : `🏰 ${playerCount} 人開始遊戲`}
          </button>
        ) : (
          <div className="text-center" style={{ color: 'var(--fg-secondary)', padding: '12px 0' }}>⏳ 等待房主開始遊戲…</div>
        )}
        <button onClick={onLeave} className="btn btn-ghost btn-full" style={{ color: 'var(--fg-muted)' }}>離開房間</button>
      </div>
    </div>
  );
};
