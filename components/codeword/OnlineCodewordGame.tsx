'use client';

import React from 'react';
import { usePeerRoom } from '@/hooks/usePeerRoom';
import { codewordEngine } from '@/lib/codewordEngine';
import { PeerRoomScreen } from '@/components/room/PeerRoomScreen';
import { CodewordRoomLobby } from './CodewordRoomLobby';
import { CodewordRoomGame } from './CodewordRoomGame';

interface OnlineCodewordGameProps {
  initialRoomId?: string | null;
  onExit: () => void;
}

// 密語特工多手機版：隊長用手機看答案地圖出題，隊員用手機提議、翻牌，手機自動當裁判
export const OnlineCodewordGame: React.FC<OnlineCodewordGameProps> = ({ initialRoomId, onExit }) => {
  const room = usePeerRoom(codewordEngine, initialRoomId);

  return (
    <PeerRoomScreen
      room={room}
      codePrefix={codewordEngine.codePrefix}
      initialRoomId={initialRoomId}
      onExit={onExit}
      title="🕵️ 密語特工・分隊猜詞"
      subtitle="紅藍兩隊，隊長看答案地圖給提示，隊員在手機上討論、翻牌，先找完自己隊密語的隊伍獲勝"
      leaveWarning="對局中離開會退出隊伍；如果你是隊長，會由隊友接任。"
      renderRoom={(view, onLeave) => view.phase === 'LOBBY'
        ? <CodewordRoomLobby view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} />
        : <CodewordRoomGame view={view} isBusy={room.isBusy} onAct={room.act} onLeave={onLeave} serverNow={room.serverNow} />}
    />
  );
};
