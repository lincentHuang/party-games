'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { plotEngine } from '@/lib/plotEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { PlotRoomLobby } from './PlotRoomLobby';
import { PlotRoomGame } from './PlotRoomGame';

interface OnlinePlotGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 宮廷密謀多手機版：每個人用自己的手機看暗牌、宣稱、質疑，手機自動當裁判
export const OnlinePlotGame: React.FC<OnlinePlotGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(plotEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={plotEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="🏰 宮廷密謀・吹牛與質疑"
      subtitle="每人兩張暗牌，敢宣稱就敢賭：吹牛、質疑、阻擋，最後存活的人獲勝（2–6 人）"
      leaveWarning="對局中離開會被當成淘汰。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <PlotRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <PlotRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />}
    />
  );
};
