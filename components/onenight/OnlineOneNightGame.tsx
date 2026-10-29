'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { oneNightEngine } from '@/lib/oneNightEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { OneNightRoomLobby } from './OneNightRoomLobby';
import { OneNightRoomGame } from './OneNightRoomGame';

interface OnlineOneNightGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 月夜換牌多手機版：每個人用自己的手機看牌、夜晚行動、投票，只要一個晚上就分勝負
export const OnlineOneNightGame: React.FC<OnlineOneNightGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(oneNightEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={oneNightEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="🌙 月夜換牌"
      subtitle="一夜決勝負：大家同時在手機上行動、換牌，天亮後討論並投票揪出狼人（3–10 人）"
      leaveWarning="對局中有人離開，這一局會中止並回到房間。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <OneNightRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <OneNightRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} serverNow={room.serverNow} />}
    />
  );
};
