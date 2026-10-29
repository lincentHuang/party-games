'use client';

import React from 'react';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { roundtableEngine } from '@/lib/roundtableEngine';
import { RoundtableGame } from './RoundtableGame';
import { RoundtableLobby } from './RoundtableLobby';

interface OnlineRoundtableGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 圓桌狼人多手機版：白天組隊出任務（阿瓦隆），夜晚狼人殺人（狼人殺），每人一支手機
export const OnlineRoundtableGame: React.FC<OnlineRoundtableGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(roundtableEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={roundtableEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="🛡️🐺 圓桌狼人"
      subtitle="白天組隊出任務，夜晚狼人現身。阿瓦隆加狼人殺，每人一支手機"
      leaveWarning="對局中離開會被當成陣亡。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <RoundtableLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <RoundtableGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />}
    />
  );
};
