'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { avalonEngine } from '@/lib/avalonEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { AvalonRoomLobby } from './AvalonRoomLobby';
import { AvalonRoomGame } from './AvalonRoomGame';

interface OnlineAvalonGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 阿瓦隆多手機版：每個人用自己的手機看角色、秘密投票、出任務牌
export const OnlineAvalonGame: React.FC<OnlineAvalonGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(avalonEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={avalonEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="⚔️ 阿瓦隆・每人一支手機"
      subtitle="手機只負責發身分、秘密投票和判定，推理與說服靠你的嘴巴"
      leaveWarning="對局中有人離開，本局會直接中止。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <AvalonRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <AvalonRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />}
    />
  );
};
