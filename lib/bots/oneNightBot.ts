/**
 * 月夜換牌電腦玩家：只依自己的視角（OneNightRoomView）決定下一步，不偷看別人的牌。
 * 沒事可做就回傳 null；房主專屬操作（START／START_VOTE／FORCE_NIGHT／CLOSE_VOTE…）由真人房主負責。
 * 電腦不會講話，白天不做任何事。
 * 這個檔案只 import 型別與常數，避免和規則引擎循環引用。
 */

import { CENTER_COUNT, NONE, OneNightAction, OneNightRoomView } from '@/types/oneNightRoom';

const pick = <T,>(list: T[]): T | null => (list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null);

export function oneNightBotAction(view: OneNightRoomView): OneNightAction | null {
  const my = view.mySeat;
  const meId = view.me.id;
  if (!my) return null;
  const others = view.seats.filter(s => s.playerId !== meId).map(s => s.playerId);

  switch (view.phase) {
    case 'REVEAL':
      return my.ready ? null : { action: 'READY' };

    case 'NIGHT': {
      const night = view.night;
      if (!night || night.myDone) return null;
      switch (night.task) {
        case 'WOLF_ACK':
        case 'MINION_ACK':
        case 'INSOMNIAC':
          return { action: 'NIGHT_ACK' };
        case 'WOLF_PEEK':
          return { action: 'WOLF_PEEK', index: Math.random() < 0.7 ? Math.floor(Math.random() * CENTER_COUNT) : null };
        case 'SEER': {
          if (Math.random() < 0.4) {
            const a = Math.floor(Math.random() * CENTER_COUNT);
            const b = (a + 1 + Math.floor(Math.random() * (CENTER_COUNT - 1))) % CENTER_COUNT;
            return { action: 'SEER_CENTER', indices: [a, b] };
          }
          const t = pick(others);
          return t ? { action: 'SEER_PLAYER', targetId: t } : null;
        }
        case 'ROBBER': {
          const t = Math.random() < 0.75 ? pick(others) : null;
          return { action: 'ROBBER', targetId: t ?? NONE };
        }
        case 'TROUBLEMAKER': {
          if (others.length < 2 || Math.random() < 0.1) return { action: 'TROUBLEMAKER', aId: NONE, bId: NONE };
          const a = pick(others)!;
          const b = pick(others.filter(id => id !== a))!;
          return { action: 'TROUBLEMAKER', aId: a, bId: b };
        }
        case 'DRUNK':
          return { action: 'DRUNK', index: Math.floor(Math.random() * CENTER_COUNT) };
        case 'GUESS': {
          const t = pick(others);
          return t ? { action: 'GUESS', targetId: t } : null;
        }
        default:
          return null;
      }
    }

    case 'VOTE': {
      if (view.myVote || others.length === 0) return null;
      // 我確定知道的狼／好人
      const knownWolves = new Set<string>();
      const knownSafe = new Set<string>();
      let amWolf = my.initial === 'WOLF';
      let guess: string | null = null;
      for (const it of view.intel) {
        if (it.kind === 'WOLF_MATES') it.ids.forEach(id => knownSafe.add(id)); // 狼隊友：自己人，不投
        if (it.kind === 'MINION_SEES') it.ids.forEach(id => knownSafe.add(id));
        if (it.kind === 'SEE_PLAYER') (it.role === 'WOLF' ? knownWolves : knownSafe).add(it.targetId);
        if (it.kind === 'ROBBED') {
          if (it.role === 'WOLF') amWolf = true; // 我搶到狼牌，現在是狼
          knownSafe.add(it.targetId); // 對方現在拿的是我的強盜牌
        }
        if (it.kind === 'INSOMNIAC' && it.role === 'WOLF') amWolf = true;
        if (it.kind === 'GUESS') guess = it.targetId;
      }

      // 預言家：有看到狼就投他（但我是狼隊自己人就不投）
      const wolfPick = [...knownWolves].filter(id => others.includes(id) && !(amWolf && knownSafe.has(id)));
      if (wolfPick.length > 0 && !amWolf && my.initial !== 'MINION') return { action: 'VOTE', targetId: pick(wolfPick)! };

      let pool = others.filter(id => !knownSafe.has(id));
      if (pool.length === 0) pool = others;

      // 自己夜間猜測的對象，六成機率投他
      if (guess && pool.includes(guess) && !amWolf && Math.random() < 0.6) return { action: 'VOTE', targetId: guess };
      return { action: 'VOTE', targetId: pick(pool)! };
    }

    default:
      return null;
  }
}
