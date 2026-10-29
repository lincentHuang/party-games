'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { spyEngine } from '@/lib/spyEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { SpyRoomLobby } from './SpyRoomLobby';
import { SpyRoomGame } from './SpyRoomGame';

interface OnlineSpyGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 誰是間諜多手機版：每個人用自己的手機看詞、投票
export const OnlineSpyGame: React.FC<OnlineSpyGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(spyEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={spyEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="📱 每人一支手機"
      subtitle="每個人在自己手機上看詞、投票，大家面對面描述就好"
      leaveWarning="對局中離開會被當成出局。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <SpyRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <SpyRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} serverNow={room.serverNow} />}
    />
  );
};
