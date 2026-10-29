/**
 * 狼人殺電腦玩家：只依自己的視角（WerewolfRoomView）決定下一步。
 * 沒事可做就回傳 null；房主專屬操作（START／CONTINUE／FORCE_NIGHT／CLOSE_VOTE…）由真人房主負責。
 * 電腦不會講話：輪到發言或遺言時直接結束，花的時間就是連線層的 0.9–2.4 秒延遲。
 * 這個檔案只 import 型別與常數，避免和規則引擎循環引用。
 */

import { NONE, WerewolfAction, WerewolfRoomView } from '@/types/werewolfRoom';

const pick = <T,>(list: T[]): T | null => (list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null);

export function werewolfBotAction(view: WerewolfRoomView): WerewolfAction | null {
  const my = view.mySeat;
  const meId = view.me.id;
  if (!my) return null;
  const mySeatView = view.seats.find(s => s.playerId === meId);
  if (!mySeatView || mySeatView.left) return null;

  const aliveOthers = view.seats.filter(s => s.isAlive && !s.left && s.playerId !== meId).map(s => s.playerId);
  const mates = my.mates ?? [];
  const knownWolves = (my.seerChecks ?? [])
    .filter(c => c.isWolf && aliveOthers.includes(c.targetId))
    .map(c => c.targetId);

  switch (view.phase) {
    case 'REVEAL':
      return my.ready ? null : { action: 'READY' };

    case 'NIGHT': {
      const night = view.night;
      if (!night || night.myDone || !my.isAlive) return null;
      switch (night.task) {
        case 'GUARD': {
          const last = night.guard?.lastTarget ?? null;
          const options = view.seats.filter(s => s.isAlive && !s.left && s.playerId !== last).map(s => s.playerId);
          const t = pick(options);
          return { action: 'GUARD', targetId: t ?? NONE };
        }
        case 'WOLF': {
          const picks = night.wolf?.picks ?? {};
          const counts = new Map<string, number>();
          for (const t of Object.values(picks)) counts.set(t, (counts.get(t) ?? 0) + 1);
          let target: string | null = null;
          if (counts.size > 0) {
            // 跟隨票數最多的目標，同票取代號最小者，大家就會收斂到同一人
            const max = Math.max(...counts.values());
            target = [...counts.entries()].filter(([, c]) => c === max).map(([t]) => t).sort()[0];
          } else {
            target = pick(aliveOthers.filter(id => !mates.includes(id)));
          }
          if (!target) target = NONE;
          if (picks[meId] === target) return null;
          return { action: 'WOLF_PICK', targetId: target };
        }
        case 'SEER': {
          const checked = new Set((my.seerChecks ?? []).map(c => c.targetId));
          const fresh = aliveOthers.filter(id => !checked.has(id));
          const t = pick(fresh) ?? pick(aliveOthers);
          return t ? { action: 'SEER_CHECK', targetId: t } : null;
        }
        case 'REFLECT': {
          const t = pick(aliveOthers);
          return t ? { action: 'REFLECT', targetId: t } : null;
        }
        default:
          return null;
      }
    }

    case 'NIGHT_WITCH': {
      const night = view.night;
      if (!night || night.myDone || !my.isAlive) return null;
      if (night.task === 'ACK') return { action: 'NIGHT_ACK' };
      if (night.task !== 'WITCH') return null;
      const victim = night.witch?.victimId ?? null;
      if (my.potions?.antidote && victim && victim !== meId) {
        const chance = view.round === 1 ? 0.7 : 0.3;
        if (Math.random() < chance) return { action: 'WITCH', choice: 'SAVE' };
      }
      if (my.potions?.poison && view.round >= 2 && Math.random() < 0.15) {
        const t = pick(aliveOthers);
        if (t) return { action: 'WITCH', choice: 'POISON', targetId: t };
      }
      return { action: 'WITCH', choice: 'NONE' };
    }

    case 'DAWN':
    case 'EXILE': {
      const lw = view.lastWords;
      if (lw && lw.index < lw.queue.length && lw.queue[lw.index] === meId) return { action: 'LAST_WORDS_DONE' };
      return null;
    }

    case 'HUNTER': {
      const h = view.hunter;
      if (!h || h.resolved || h.hunterId !== meId) return null;
      return { action: 'HUNTER_SHOT', targetId: pick(aliveOthers) ?? NONE };
    }

    case 'DAY':
      return view.speakQueue[view.speakIndex] === meId && my.isAlive ? { action: 'NEXT_SPEAKER' } : null;

    case 'VOTE': {
      if (!my.isAlive || view.myVote) return null;
      const options = view.candidates.filter(id => id !== meId && aliveOthers.includes(id));
      if (options.length === 0) return { action: 'VOTE', targetId: NONE };

      // 預言家：優先投已查出的狼
      const wolfOption = options.filter(id => knownWolves.includes(id));
      if (wolfOption.length > 0) return { action: 'VOTE', targetId: pick(wolfOption)! };

      // 狼人：不投隊友
      const pool = my.role === 'WOLF' ? options.filter(id => !mates.includes(id)) : options;
      const candidates = pool.length > 0 ? pool : options;

      // 平票 PK：看得到上一輪票數，好人有一半機率跟票數最多的人
      if (my.role !== 'WOLF' && view.ballots.length > 0 && Math.random() < 0.5) {
        const tally = new Map<string, number>();
        for (const t of Object.values(view.ballots[view.ballots.length - 1].votes)) {
          if (candidates.includes(t)) tally.set(t, (tally.get(t) ?? 0) + 1);
        }
        if (tally.size > 0) {
          const max = Math.max(...tally.values());
          return { action: 'VOTE', targetId: pick([...tally.entries()].filter(([, c]) => c === max).map(([t]) => t))! };
        }
      }
      return { action: 'VOTE', targetId: pick(candidates)! };
    }

    default:
      return null;
  }
}
