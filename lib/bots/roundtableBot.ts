/**
 * 圓桌狼人電腦玩家：只依自己的視角（RoundtableRoomView）決定下一步。
 * 沒事可做就回傳 null；房主專屬操作（START／CONTINUE／FORCE_RESOLVE…）由真人房主負責，
 * 電腦也不會替隊長按「繼續」（讓真人有時間看投票與任務結果），更不會發言。
 * 這個檔案只 import 型別與常數，避免和規則引擎循環引用。
 */

import { ALIGNMENT_COUNT_BY_PLAYERS } from '@/lib/avalonRules';
import { RT_NONE, RoundtableAction, RoundtableRoomView, RtVoteSnapshot } from '@/types/roundtableRoom';

const MAX_REJECTS = 5;

const rand = Math.random;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pickOne = <T,>(list: T[]): T | null => (list.length > 0 ? list[Math.floor(rand() * list.length)] : null);

// 依分數（加一點隨機）由高到低排序
function sortByScore(ids: string[], score: (id: string) => number, noise: number): string[] {
  return ids
    .map(id => ({ id, s: score(id) + rand() * noise }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.id);
}

// ───────── 記憶：每個電腦自己看過的公開投票紀錄（只來自自己的視角） ─────────

const voteMemory = new Map<string, { keys: Set<string>; list: RtVoteSnapshot[] }>();

function rememberVotes(view: RoundtableRoomView): RtVoteSnapshot[] {
  const key = `${view.roomId}:${view.me.id}`;
  let mem = voteMemory.get(key);
  // 新的一局從 REVEAL 開始，清掉舊紀錄
  if (!mem || view.phase === 'REVEAL') {
    mem = { keys: new Set(), list: [] };
    voteMemory.set(key, mem);
  }
  const v = view.lastVote;
  if (v) {
    const k = `${v.round}|${v.leaderId}|${v.team.join(',')}|${v.rejectCount}|${JSON.stringify(v.votes)}`;
    if (!mem.keys.has(k)) {
      mem.keys.add(k);
      mem.list.push(v);
    }
  }
  return mem.list;
}

// ───────── 共用分析 ─────────

// 好人視角的狼人機率推理：窮舉所有「狼人名單」組合，依據任務結果、預言家查驗、
// 陣亡公開的身分算出每種組合的可能性，再得到每個人是狼人的機率與任一隊伍全是好人的機率。
const HIDE_RATE = 0.5; // 狼人上了任務隊伍卻出成功牌的機率（用來降低「成功隊伍＝全好人」的確定性）
const HIDDEN_WOLF_RATE = 0.15; // 預言家查出「好人」其實是隱狼的權重

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === k) { out.push([...acc]); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); walk(i + 1, acc); acc.pop(); }
  };
  walk(0, []);
  return out;
}

interface Posterior {
  marg: Record<string, number>;
  pClean: (team: string[]) => number;
}

function buildPosterior(view: RoundtableRoomView): Posterior {
  const meId = view.me.id;
  const ids = view.seats.filter(s => !s.left).map(s => s.playerId);
  const total = Math.min(Math.max(view.seats.length, 5), 10);
  const wolfCount = ALIGNMENT_COUNT_BY_PLAYERS[total]?.evil ?? 2;
  const universe = ids.filter(id => id !== meId); // 我是好人，所以我不是狼
  const checks = view.mySeat?.seerChecks ?? [];
  const mustEvil = new Set<string>();
  const mustGood = new Set<string>();
  for (const c of checks) if (c.showsEvil) mustEvil.add(c.targetId);
  for (const s of view.seats) {
    if (!s.role) continue;
    if (s.role === 'WOLF' || s.role === 'HIDDEN_WOLF') mustEvil.add(s.playerId);
    else mustGood.add(s.playerId);
  }
  const cleanChecked = new Set(checks.filter(c => !c.showsEvil).map(c => c.targetId));

  const sets: { set: Set<string>; w: number }[] = [];
  for (const combo of combinations(universe, Math.min(wolfCount, universe.length))) {
    const set = new Set(combo);
    let w = 1;
    let ok = true;
    for (const id of mustEvil) if (!set.has(id)) { ok = false; break; }
    if (!ok) continue;
    for (const id of mustGood) if (set.has(id) && !mustEvil.has(id)) { ok = false; break; }
    if (!ok) continue;
    for (const id of cleanChecked) if (set.has(id)) w *= HIDDEN_WOLF_RATE;
    for (const q of view.quests) {
      if (q.status === 'PENDING') continue;
      const k = q.team.filter(id => set.has(id)).length;
      if (q.status === 'FAILED') {
        if (k < Math.max(1, q.failCount ?? 1)) { ok = false; break; }
      } else {
        // 成功的任務：隊上的狼人每個都得「藏牌」；需要兩張失敗牌的任務，一個狼人本來就無法讓任務失敗
        const hidden = q.requiresTwoFails ? (k >= 2 ? k : 0) : k;
        w *= Math.pow(HIDE_RATE, hidden);
      }
    }
    if (ok) sets.push({ set, w });
  }
  if (sets.length === 0) { // 推理自相矛盾（例如被預言家以外的因素影響）→ 當作沒有資訊
    for (const combo of combinations(universe, Math.min(wolfCount, universe.length))) sets.push({ set: new Set(combo), w: 1 });
  }
  const sum = sets.reduce((n, x) => n + x.w, 0) || 1;
  const marg: Record<string, number> = {};
  for (const id of universe) marg[id] = 0;
  for (const x of sets) for (const id of x.set) marg[id] += x.w / sum;
  const pClean = (team: string[]) =>
    sets.reduce((n, x) => n + (team.some(id => x.set.has(id)) ? 0 : x.w), 0) / sum;
  return { marg, pClean };
}

// 狼人視角：誰像預言家？提案避開狼人、否決有狼的隊伍、贊成沒狼的隊伍都加分
function buildSeerLikeness(view: RoundtableRoomView, history: RtVoteSnapshot[], evil: Set<string>): Record<string, number> {
  const score: Record<string, number> = {};
  const add = (id: string, n: number) => { if (!evil.has(id)) score[id] = (score[id] ?? 0) + n; };
  for (const snap of history) {
    const wolfOnTeam = snap.team.some(id => evil.has(id));
    if (!wolfOnTeam) add(snap.leaderId, 1);
    for (const [voter, approve] of Object.entries(snap.votes)) {
      if (wolfOnTeam) add(voter, approve ? -0.5 : 1);
      else if (approve) add(voter, 0.2);
    }
  }
  return score;
}

// 狼人刀口／最後獵殺：跟著隊友收斂。ID 最小的已選狼人不改選，其他人都跟他，保證收斂。
function convergePick(
  meId: string,
  picks: Record<string, string>,
  candidates: string[],
  choose: () => string | null
): string | null {
  const others = Object.keys(picks).filter(id => id !== meId && picks[id] !== RT_NONE && candidates.includes(picks[id])).sort();
  const mine = picks[meId];
  const lead = others[0];
  if (mine === undefined) return lead ? picks[lead] : choose();
  if (lead && lead < meId && picks[lead] !== mine) return picks[lead];
  return null;
}

// ───────── 主函式 ─────────

export function roundtableBotAction(view: RoundtableRoomView): RoundtableAction | null {
  const my = view.mySeat;
  const meId = view.me.id;
  if (!my) return null;
  const mySeatView = view.seats.find(s => s.playerId === meId);
  if (!mySeatView || mySeatView.left) return null;

  const history = rememberVotes(view);
  const alive = view.seats.filter(s => s.alive && !s.left).map(s => s.playerId);
  const aliveOthers = alive.filter(id => id !== meId);
  const isEvil = my.team === 'EVIL';
  // 我知道的壞人（含自己）
  const evil = new Set<string>(isEvil ? [meId, ...(my.mates ?? []).map(m => m.playerId)] : []);
  const evilAlive = alive.filter(id => evil.has(id));
  // 只有好人需要推理狼人是誰；壞人什麼都知道
  const post = isEvil ? null : buildPosterior(view);
  const susOf = (id: string) => post?.marg[id] ?? 0;
  const succeeded = view.quests.filter(q => q.status === 'SUCCESS').length;
  const failed = view.quests.filter(q => q.status === 'FAILED').length;
  const quest = view.quests[view.questIndex];

  switch (view.phase) {
    case 'REVEAL':
      return my.ready ? null : { action: 'READY' };

    // 隊長挑隊員
    case 'PROPOSE': {
      if (view.leaderId !== meId || !my.alive || !quest) return null;
      const need = quest.requiredPlayers;
      const team: string[] = [meId];

      if (isEvil) {
        // 壞人隊長：自己 + 視情況帶隊友，其餘隨機好人
        const allies = evilAlive.filter(id => id !== meId);
        let wantWolves = 1;
        if (quest.requiresTwoFails) wantWolves = 2;
        else if (need >= 4 && rand() < 0.15) wantWolves = 2;
        wantWolves = Math.min(wantWolves, need, allies.length + 1);
        for (const id of sortByScore(allies, () => 0, 1)) {
          if (team.length >= wantWolves) break;
          team.push(id);
        }
        const goods = alive.filter(id => !evil.has(id));
        for (const id of sortByScore(goods, () => 0, 1)) {
          if (team.length >= need) break;
          team.push(id);
        }
        // 好人不夠就用隊友補滿
        for (const id of allies) {
          if (team.length >= need) break;
          if (!team.includes(id)) team.push(id);
        }
      } else {
        // 好人隊長：自己 + 最可信的人（嫌疑低、預言家確認過的優先）
        // 窮舉所有可能的隊伍，挑「全是好人」機率最高的（加一點隨機避免被摸透）
        let bestScore = -1;
        let best: string[] = [];
        for (const combo of combinations(aliveOthers, Math.max(0, need - 1))) {
          const score = (post?.pClean([meId, ...combo]) ?? 0) * (1 + 0.3 * rand());
          if (score > bestScore) { bestScore = score; best = combo; }
        }
        team.push(...best);
      }
      return { action: 'PROPOSE', team: team.slice(0, need) };
    }

    // 全員表決（亡魂也要投）
    case 'TEAM_VOTE': {
      if (view.myVote !== null) return null;
      const team = view.proposedTeam;
      const onTeam = team.includes(meId);
      const lastChance = view.rejectCount >= MAX_REJECTS - 1;

      if (isEvil) {
        // 第五次提案被否決＝狼人直接獲勝
        if (lastChance) return { action: 'VOTE', approve: false };
        const wolvesOnTeam = team.filter(id => evil.has(id)).length;
        let p: number;
        if (wolvesOnTeam === 0) p = 0.5;
        else if (quest?.requiresTwoFails && wolvesOnTeam < 2) p = 0.5;
        else p = 0.92;
        return { action: 'VOTE', approve: rand() < p };
      }

      // 好人：第五次提案一律贊成
      if (lastChance) return { action: 'VOTE', approve: true };
      if (view.leaderId === meId) return { action: 'VOTE', approve: true };
      // 預言家看到有確定的狼在隊上 → 否決
      const known = (my.seerChecks ?? []).filter(c => c.showsEvil).map(c => c.targetId);
      if (team.some(id => known.includes(id))) return { action: 'VOTE', approve: false };
      // 和「我能提出的最乾淨隊伍」比較：越接近越贊成，明顯更危險就傾向否決
      const clean = post!.pClean(team);
      let best = 0;
      for (const combo of combinations(aliveOthers, Math.max(0, (quest?.requiredPlayers ?? team.length) - 1))) {
        best = Math.max(best, post!.pClean([meId, ...combo]));
      }
      const ratio = best > 0 ? clean / best : 1;
      const p = clamp(Math.pow(ratio, 1.5) * 0.95 + (onTeam ? 0.05 : 0), 0.05, 0.95);
      return { action: 'VOTE', approve: rand() < p };
    }

    // 出任務牌
    case 'QUEST': {
      if (!view.proposedTeam.includes(meId) || view.myQuestCard !== null) return null;
      if (!isEvil) return { action: 'QUEST_CARD', success: true };
      const wolvesOnTeam = view.proposedTeam.filter(id => evil.has(id)).length;
      if (quest?.requiresTwoFails && wolvesOnTeam < 2) return { action: 'QUEST_CARD', success: true };
      if (failed >= 2) return { action: 'QUEST_CARD', success: false };
      // 前期常常先出成功牌隱藏身分，後期才露出爪牙
      const p = quest?.requiresTwoFails
        ? 0.85
        : wolvesOnTeam > 1 ? 0.35 : view.questIndex === 0 ? 0.25 : 0.42;
      return { action: 'QUEST_CARD', success: rand() >= p };
    }

    // 夜晚
    case 'NIGHT': {
      const night = view.night;
      if (!night || night.myDone || !my.alive) return null;
      switch (night.task) {
        case 'WOLF': {
          const goods = alive.filter(id => !evil.has(id));
          const choose = () => {
            const likeness = buildSeerLikeness(view, history, evil);
            const ranked = sortByScore(goods, id => likeness[id] ?? 0, 0.8);
            return ranked[0] ?? null;
          };
          const t = convergePick(meId, night.wolf?.picks ?? {}, goods, choose);
          return t ? { action: 'WOLF_PICK', targetId: t } : null;
        }
        case 'SEER': {
          const checked = new Set((my.seerChecks ?? []).map(c => c.targetId));
          const fresh = aliveOthers.filter(id => !checked.has(id));
          const pool = fresh.length > 0 ? fresh : aliveOthers;
          // 優先查嫌疑高的人
          const t = sortByScore(pool, susOf, 1.2)[0];
          return t ? { action: 'SEER_CHECK', targetId: t } : null;
        }
        case 'GUARD': {
          const last = my.lastGuardTarget ?? null;
          const options = alive.filter(id => id !== last);
          // 偶爾守自己，其餘隨機
          const t = options.includes(meId) && rand() < 0.2 ? meId : pickOne(options);
          return t ? { action: 'GUARD', targetId: t } : null;
        }
        case 'REFLECT': {
          // 好人懷疑嫌疑高的人；壞人隨機點一個好人
          const pool = isEvil ? aliveOthers.filter(id => !evil.has(id)) : aliveOthers;
          const t = isEvil ? pickOne(pool.length > 0 ? pool : aliveOthers) : sortByScore(aliveOthers, susOf, 1)[0];
          return t ? { action: 'REFLECT', targetId: t } : null;
        }
        default:
          return null;
      }
    }

    // 獵人開槍
    case 'HUNTER': {
      const h = view.hunter;
      if (!h || h.resolved || h.hunterId !== meId) return null;
      const ranked = sortByScore(aliveOthers, susOf, 0.5);
      const top = ranked[0];
      if (top && susOf(top) >= 0.6) return { action: 'HUNTER_SHOT', targetId: top };
      // 沒線索時多半放棄，免得誤傷好人
      if (top && rand() < 0.2) return { action: 'HUNTER_SHOT', targetId: pickOne(aliveOthers)! };
      return { action: 'HUNTER_SHOT', targetId: RT_NONE };
    }

    // 最後獵殺：狼人猜預言家
    case 'FINAL_HUNT': {
      const hunt = view.hunt;
      if (!hunt || !hunt.canPick) return null;
      const choose = () => {
        const likeness = buildSeerLikeness(view, history, evil);
        return sortByScore(hunt.candidates, id => likeness[id] ?? 0, 0.8)[0] ?? null;
      };
      const t = convergePick(meId, hunt.picks, hunt.candidates, choose);
      return t ? { action: 'HUNT_PICK', targetId: t } : null;
    }

    default:
      return null;
  }
}
