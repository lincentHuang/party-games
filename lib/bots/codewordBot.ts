/**
 * 密語特工電腦隊員：只依自己的視角（CodewordRoomView）決定下一步。
 * 電腦不懂語意，只會「跟隨隊友」或隨機提議；電腦永遠只當隊員，不會出題，
 * 房主專屬操作（START／NEXT_ROUND…）也不交給電腦。
 * 這個檔案只 import 型別，避免和規則引擎循環引用。
 */

import { CodewordAction, CodewordRoomView } from '@/types/codewordRoom';

const pick = <T,>(list: T[]): T | null => (list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null);

export function codewordBotAction(view: CodewordRoomView): CodewordAction | null {
  if (view.phase !== 'GUESS' || view.myRole !== 'GUESSER' || view.myTeam !== view.turn) return null;
  const meId = view.me.id;
  const open = view.board.filter(c => !c.revealed).map(c => c.index);
  if (open.length === 0) return null;

  const mates = view.members.filter(m => m.team === view.myTeam && !m.isCaptain && m.playerId !== meId);
  const humanIds = new Set(mates.filter(m => !m.isBot).map(m => m.playerId));
  const mine = view.proposals[meId];

  // 優先跟隨真人隊友提議的牌（票數最多者），其次是任何隊友的提議
  const tallyOf = (ids: Set<string> | null) => {
    const tally = new Map<number, number>();
    for (const [pid, idx] of Object.entries(view.proposals)) {
      if (pid === meId || !open.includes(idx)) continue;
      if (ids && !ids.has(pid)) continue;
      tally.set(idx, (tally.get(idx) ?? 0) + 1);
    }
    if (tally.size === 0) return null;
    const max = Math.max(...tally.values());
    return [...tally.entries()].filter(([, c]) => c === max).map(([i]) => i).sort((a, b) => a - b)[0];
  };
  const follow = tallyOf(humanIds) ?? tallyOf(null);

  if (follow !== null) {
    if (mine === follow) return null; // 已經跟上了，等大家同意
    // 我提議的是別張牌：只在真人隊友不是提議它時才改跟（避免電腦互相來回改）
    if (mine !== undefined && tallyOf(humanIds) === null) return null;
    return { action: 'PROPOSE', index: follow };
  }

  if (mine !== undefined) return null; // 自己的提議還沒人跟，等等

  // 沒有任何提議：猜過至少一張後 50% 機率結束猜測
  if (view.guessesUsed >= 1 && Math.random() < 0.5) return { action: 'END_GUESS' };
  const t = pick(open);
  return t === null ? null : { action: 'PROPOSE', index: t };
}
