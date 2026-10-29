'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { werewolfEngine } from '@/lib/werewolfEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { WerewolfRoomLobby } from './WerewolfRoomLobby';
import { WerewolfRoomGame } from './WerewolfRoomGame';

interface OnlineWerewolfGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 狼人殺多手機版：每個人用自己的手機看身分、夜晚行動、投票，手機自動當法官
export const OnlineWerewolfGame: React.FC<OnlineWerewolfGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(werewolfEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={werewolfEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="🐺 狼人殺・手機當法官"
      subtitle="每人一支手機，發身分、夜晚行動、投票全部自動判定，不需要真人法官"
      leaveWarning="對局中離開會被當成出局。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <WerewolfRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <WerewolfRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} serverNow={room.serverNow} />}
    />
  );
};
