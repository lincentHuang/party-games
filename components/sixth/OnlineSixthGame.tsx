'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { sixthEngine } from '@/lib/sixthEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { SixthRoomLobby } from './SixthRoomLobby';
import { SixthRoomGame } from './SixthRoomGame';

interface OnlineSixthGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 第六張爆炸多手機版：每個人用自己的手機選牌，房主手機負責發牌與結算
export const OnlineSixthGame: React.FC<OnlineSixthGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(sixthEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={sixthEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="💥 第六張爆炸"
      subtitle="同時出牌、由小到大排列，擺成第 6 張就要吃整列炸彈，最少的人獲勝"
      leaveWarning="對局中離開會被移除，你的手牌作廢。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <SixthRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <SixthRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />}
    />
  );
};
