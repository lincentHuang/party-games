/**
 * 阿瓦隆 - 電腦玩家
 * 只看自己的視角（AvalonRoomView）決定下一步，不偷看房主的完整狀態。
 * 沒事可做（已投過票、不在隊伍、不是隊長…）就回傳 null；房主專屬操作（開始、繼續、強制開票）不在這裡。
 */

import type { AvalonAction, AvalonQuestView, AvalonRoomView, AvalonVoteSnapshot } from '@/types/avalonRoom';

// ---------- 記憶：視角裡只有「上一次」表決，所以把看過的公開表決記下來，終局刺客推理用 ----------

interface BotMemory {
  history: AvalonVoteSnapshot[];
  seen: Set<string>;
}

const memories = new Map<string, BotMemory>();

function getMemory(view: AvalonRoomView): BotMemory {
  const key = `${view.roomId}|${view.me.id}`;
  let mem = memories.get(key);
  if (!mem) {
    mem = { history: [], seen: new Set() };
    memories.set(key, mem);
  }
  // 新的一局（角色牌重發）就清掉舊紀錄
  if (view.phase === 'LOBBY' || view.phase === 'REVEAL') {
    mem.history = [];
    mem.seen.clear();
  }
  const s = view.lastVote;
  if (s) {
    const id = `${s.round}|${s.rejectCount}|${s.leaderId}|${s.team.join(',')}|${s.approved}`;
    if (!mem.seen.has(id)) {
      mem.seen.add(id);
      mem.history.push(s);
    }
  }
  return mem;
}

// ---------- 小工具 ----------

const chance = (p: number) => Math.random() < p;
const noise = (amp: number) => (Math.random() - 0.5) * 2 * amp;

function sample<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}


function wins(view: AvalonRoomView) {
  const good = view.quests.filter(q => q.status === 'SUCCESS').length;
  const evil = view.quests.filter(q => q.status === 'FAILED').length;
  return { good, evil };
}

// 夜間視野裡認得的壞人同伴（壞人用）
function alliesOf(view: AvalonRoomView): string[] {
  if (view.mySeat?.alignment !== 'EVIL') return [];
  return view.mySeat.vision.map(v => v.playerId);
}

// ---------- 好人推理：把所有「壞人名單」的可能組合列出來，依線索加權，得到每個人是壞人的機率 ----------

function evilCountOf(playerCount: number): number {
  return playerCount >= 10 ? 4 : playerCount >= 7 ? 3 : 2;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const out: T[][] = [];
  const [head, ...rest] = arr;
  for (const c of combinations(rest, k - 1)) out.push([head, ...c]);
  for (const c of combinations(rest, k)) out.push(c);
  return out;
}

const choose = (n: number, k: number) => {
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
};

interface Belief {
  worlds: { evil: Set<string>; weight: number }[];
  total: number;
}

function buildBelief(view: AvalonRoomView, mem: BotMemory): Belief {
  const me = view.me.id;
  const mySeat = view.mySeat!;
  const ids = view.seats.map(s => s.playerId).filter(id => id !== me); // 我是好人，不可能在壞人名單裡
  const e = evilCountOf(view.seats.length);
  const vision = mySeat.vision.map(v => v.playerId);
  const lady = view.lady.myResults;
  const worlds: Belief['worlds'] = [];
  let total = 0;

  for (const combo of combinations(ids, e)) {
    const set = new Set(combo);
    // 硬性線索
    if (mySeat.role === 'MERLIN' && !vision.every(id => set.has(id))) continue; // 梅林看到的都是壞人（莫德雷德除外）
    if (mySeat.role === 'PERCIVAL' && vision.length === 2 && vision.filter(id => set.has(id)).length !== 1) continue; // 梅林與莫甘娜剛好一壞
    if (mySeat.role === 'PERCIVAL' && vision.length === 1 && set.has(vision[0])) continue; // 沒有莫甘娜時只會看到梅林
    if (lady.some(r => set.has(r.targetId) !== (r.alignment === 'EVIL'))) continue;

    let w = 1;
    // 任務結果：壞人在隊上，出失敗牌的機率約 55%
    for (const q of view.quests) {
      if (q.status === 'PENDING' || q.team.length === 0) continue;
      const m = q.team.filter(id => set.has(id)).length;
      const f = q.failCount ?? 0;
      if (m < f) { w *= 1e-6; continue; }
      w *= choose(m, f) * Math.pow(0.55, f) * Math.pow(0.45, m - f);
    }
    // 表決行為：壞人偏好贊成有壞人的隊伍，好人偏好贊成乾淨的隊伍
    for (const snap of mem.history) {
      const hasEvil = snap.team.some(id => set.has(id));
      for (const [id, approve] of Object.entries(snap.votes)) {
        if (id === me) continue;
        const pApprove = set.has(id) ? (hasEvil ? 0.9 : 0.35) : (hasEvil ? 0.45 : 0.75);
        w *= approve ? pApprove : 1 - pApprove;
      }
    }
    worlds.push({ evil: set, weight: w });
    total += w;
  }
  return { worlds, total };
}

// 每位玩家是壞人的機率
function evilProb(belief: Belief, ids: string[]): Record<string, number> {
  const p: Record<string, number> = {};
  for (const id of ids) p[id] = 0;
  if (belief.total <= 0) return p;
  for (const w of belief.worlds) for (const id of w.evil) p[id] += w.weight / belief.total;
  return p;
}

// 這支隊伍完全沒有壞人的機率
function cleanProb(belief: Belief, team: string[]): number {
  if (belief.total <= 0) return 0.5;
  let sum = 0;
  for (const w of belief.worlds) if (!team.some(id => w.evil.has(id))) sum += w.weight;
  return sum / belief.total;
}

// 公開資訊下，每個人跟失敗任務的牽連（壞人湊隊時挑「看起來乾淨」的人、刺客推理也用）
function questSuspicion(view: AvalonRoomView, susp: Record<string, number>) {
  for (const q of view.quests) {
    if (q.status === 'PENDING' || q.team.length === 0) continue;
    const fails = q.failCount ?? 0;
    for (const id of q.team) {
      if (susp[id] === undefined) continue;
      susp[id] += fails > 0 ? fails / q.team.length : -0.4;
    }
  }
}

// 壞人視角：只看公開資訊，用來挑「看起來乾淨」的好人湊隊
function evilPublicSuspicion(view: AvalonRoomView): Record<string, number> {
  const susp: Record<string, number> = {};
  for (const s of view.seats) susp[s.playerId] = 0;
  questSuspicion(view, susp);
  return susp;
}

// ---------- 各階段 ----------

function propose(view: AvalonRoomView, mem: BotMemory): AvalonAction | null {
  const me = view.me.id;
  const quest = view.quests[view.questIndex];
  if (!quest) return null;
  const k = quest.requiredPlayers;
  const others = view.seats.map(s => s.playerId).filter(id => id !== me);
  const isEvil = view.mySeat!.alignment === 'EVIL';
  const team = new Set<string>([me]); // 不論陣營，隊長都把自己放進去

  if (isEvil) {
    const allies = alliesOf(view);
    const susp = evilPublicSuspicion(view);
    // 需要幾個壞人：兩張失敗的任務盡量放兩個，否則多半只放自己，偶爾多帶一個
    let want = quest.requiresTwoFails ? 2 : 1;
    if (!quest.requiresTwoFails && k >= 4 && chance(0.3)) want = 2;
    const shuffledAllies = allies.sort(() => Math.random() - 0.5);
    for (const a of shuffledAllies) {
      if (team.size >= Math.min(want, k)) break;
      team.add(a);
    }
    const rest = others
      .filter(id => !allies.includes(id) && !team.has(id))
      .map(id => ({ id, score: susp[id] + noise(0.8) }))
      .sort((a, b) => a.score - b.score);
    for (const r of rest) {
      if (team.size >= k) break;
      team.add(r.id);
    }
    // 好人不夠填就用同伴補
    for (const a of shuffledAllies) {
      if (team.size >= k) break;
      team.add(a);
    }
  } else {
    const prob = evilProb(buildBelief(view, mem), others);
    // 梅林雜訊放大，避免每次都避開壞人太明顯
    const amp = view.mySeat!.role === 'MERLIN' ? 0.35 : 0.1;
    const ranked = others
      .map(id => ({ id, score: prob[id] + noise(amp) }))
      .sort((a, b) => a.score - b.score);
    for (const r of ranked) {
      if (team.size >= k) break;
      team.add(r.id);
    }
  }

  // 保險：湊不滿時從剩下的人補
  for (const id of others) {
    if (team.size >= k) break;
    team.add(id);
  }
  return { action: 'PROPOSE', team: Array.from(team).slice(0, k) };
}

function vote(view: AvalonRoomView, mem: BotMemory): AvalonAction | null {
  if (view.myVote !== null) return null;
  const me = view.me.id;
  const team = view.proposedTeam;
  const fifth = view.rejectCount >= 4; // 第 5 次提案，再否決壞人直接贏
  const onTeam = team.includes(me);
  const w = wins(view);

  if (view.mySeat!.alignment === 'GOOD') {
    if (fifth) return { action: 'VOTE', approve: true };
    if (view.leaderId === me) return { action: 'VOTE', approve: true };
    const others = team.filter(id => id !== me);
    const clean = cleanProb(buildBelief(view, mem), others);
    // 跟「隨便挑一隊剛好沒壞人」的基準機率比，沒有額外線索就照常放行
    const m = view.seats.length - 1;
    const e = evilCountOf(view.seats.length);
    const prior = others.length >= m - e + 1 ? 0 : choose(m - others.length, e) / choose(m, e);
    const ratio = prior > 0 ? clean / prior : 1;
    const isMerlin = view.mySeat!.role === 'MERLIN';
    // 梅林不要每次都擋，免得被刺客看穿
    const maxReject = isMerlin ? 0.5 : 0.85;
    let rejectProb = ratio >= 1 ? 0.04 : ratio <= 0.2 ? maxReject : maxReject - ((ratio - 0.2) * (maxReject - 0.04)) / 0.8;
    // 否決次數越多越傾向放行，避免被自動判輸
    if (view.rejectCount >= 3) rejectProb *= 0.4;
    else if (view.rejectCount >= 2) rejectProb *= 0.7;
    return { action: 'VOTE', approve: !chance(rejectProb) };
  }

  // 壞人
  const allies = alliesOf(view);
  const evilOnTeam = team.filter(id => id === me || allies.includes(id)).length;
  const isOberon = view.mySeat!.role === 'OBERON';
  let approveProb: number;
  if (evilOnTeam > 0) approveProb = 0.95;
  else if (isOberon && !onTeam) approveProb = 0.5; // 看不到同伴，無從判斷
  else if (fifth) approveProb = 0.1;
  else if (w.good >= 2) approveProb = 0.05; // 好人再贏一場就贏了，乾淨的隊伍一律擋
  else if (view.questIndex === 0 && view.rejectCount === 0) approveProb = 0.5; // 第一輪裝乖
  else approveProb = 0.2;
  return { action: 'VOTE', approve: chance(approveProb) };
}

function questCard(view: AvalonRoomView): AvalonAction | null {
  const me = view.me.id;
  if (!view.proposedTeam.includes(me) || view.myQuestCard !== null) return null;
  if (view.mySeat!.alignment === 'GOOD') return { action: 'QUEST_CARD', success: true };

  const quest: AvalonQuestView | undefined = view.quests[view.questIndex];
  const allies = alliesOf(view);
  const evilOnTeam = view.proposedTeam.filter(id => id === me || allies.includes(id)).length;
  const w = wins(view);

  // 這張牌決定勝負就一定出失敗（好人再成功一次就贏、或壞人再失敗一次就贏）
  const decisive = (w.good >= 2 || w.evil >= 2) && !quest?.requiresTwoFails;
  if (decisive) return { action: 'QUEST_CARD', success: false };

  if (quest?.requiresTwoFails) {
    // 需要兩張失敗：兩個壞人都在就一起出失敗；只有我一個，出了也沒用，多半藏起來
    const failProb = evilOnTeam >= 2 ? 0.9 : 0.15;
    return { action: 'QUEST_CARD', success: !chance(failProb) };
  }

  let failProb = 0.65;
  if (view.questIndex === 0) failProb = 0.4; // 第一輪常出成功藏身份
  if (evilOnTeam >= 2) failProb = Math.min(failProb, 0.55); // 多個壞人時鬆散協調，不一定全出失敗
  return { action: 'QUEST_CARD', success: !chance(failProb) };
}

function lady(view: AvalonRoomView, mem: BotMemory): AvalonAction | null {
  if (!view.lady.enabled || view.lady.holderId !== view.me.id) return null;
  if (view.lady.checkedThisRound) return { action: 'LADY_DONE' };
  const candidates = view.lady.candidates.filter(id => id !== view.me.id);
  if (candidates.length === 0) return null;

  let target: string | undefined;
  if (view.mySeat!.alignment === 'GOOD') {
    // 好人查最可疑的人，順便加點隨機
    const prob = evilProb(buildBelief(view, mem), candidates);
    target = candidates
      .map(id => ({ id, score: prob[id] >= 0.99 || prob[id] <= 0.01 ? -99 : prob[id] + noise(0.1) })) // 已確定的不用再查
      .sort((a, b) => b.score - a.score)[0]?.id;
  } else {
    // 壞人查非同伴的人（探探誰是好人）
    const allies = alliesOf(view);
    const pool = candidates.filter(id => !allies.includes(id));
    target = sample(pool.length ? pool : candidates);
  }
  return target ? { action: 'LADY_CHECK', targetId: target } : null;
}

function assassinate(view: AvalonRoomView, mem: BotMemory): AvalonAction | null {
  if (view.mySeat?.role !== 'ASSASSIN' || !view.evilTeam) return null;
  const evilIds = new Set(view.evilTeam.map(e => e.playerId));
  const goods = view.seats.map(s => s.playerId).filter(id => !evilIds.has(id));
  if (goods.length === 0) return null;

  // 梅林的特徵：反對含壞人的隊伍、自己提的隊沒有壞人、很少在失敗的任務裡
  const score: Record<string, number> = {};
  for (const id of goods) score[id] = noise(0.6);
  for (const s of mem.history) {
    const hasEvil = s.team.some(id => evilIds.has(id));
    // 還沒有任務失敗時，一般好人根本看不出誰是壞人，這時候反對壞人隊伍的人最像梅林
    const early = !view.quests.some((q, i) => q.status === 'FAILED' && i < s.round - 1);
    const weight = early ? 1.6 : 0.5;
    for (const id of goods) {
      const approve = s.votes[id];
      if (approve === undefined) continue;
      if (hasEvil) score[id] += approve ? -weight : weight;
      else if (early && !approve) score[id] -= 0.3;
    }
    if (score[s.leaderId] !== undefined) score[s.leaderId] += hasEvil ? -0.3 : early ? 0.6 : 0.2;
  }
  for (const q of view.quests) {
    if (q.status !== 'FAILED') continue;
    for (const id of q.team) if (score[id] !== undefined) score[id] -= 0.5;
  }
  const target = goods.sort((a, b) => score[b] - score[a])[0];
  return { action: 'ASSASSINATE', targetId: target };
}

export function avalonBotAction(view: AvalonRoomView): AvalonAction | null {
  const mem = getMemory(view);
  const seat = view.mySeat;
  if (!seat) return null; // 旁觀者

  switch (view.phase) {
    case 'REVEAL':
      return seat.ready ? null : { action: 'READY' };
    case 'PROPOSE':
      return view.leaderId === view.me.id ? propose(view, mem) : null;
    case 'TEAM_VOTE':
      return vote(view, mem);
    case 'QUEST':
      return questCard(view);
    case 'LADY':
      return lady(view, mem);
    case 'ASSASSINATE':
      return assassinate(view, mem);
    default:
      return null; // VOTE_RESULT／QUEST_RESULT 由房主按繼續
  }
}
