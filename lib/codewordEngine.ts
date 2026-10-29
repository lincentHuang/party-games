/**
 * 密語特工（分隊猜詞）- 多手機房間版規則引擎（只在房主手機上執行）
 * 發牌（5×5 盤面）、隊長出題、隊員提議／翻牌、勝負判定全部由這裡處理，
 * 每支手機只拿到自己有權看到的資訊（buildCodewordView）：未翻開的牌的顏色只給隊長。
 *
 * 引擎沒有計時器，只被「操作」驅動；出題時間只存起始時間戳，畫面自己算倒數（只提醒不強制）。
 */

import { addPeerPlayer, shuffle } from '@/lib/peerRoom';
import { codewordBotAction } from '@/lib/bots/codewordBot';
import { CODEWORD_WORDS } from '@/lib/codewordWords';
import { PeerGameEngine, PeerMutation } from '@/types/peerRoom';
import {
  CardColor,
  ClueNumber,
  CodewordAction,
  CodewordCard,
  CodewordConfig,
  CodewordHostRoom,
  CodewordRole,
  CodewordRoomView,
  CodewordState,
  CodewordTeam
} from '@/types/codewordRoom';

export type CodewordMutation = PeerMutation<CodewordHostRoom>;

export const CODEWORD_MIN_PLAYERS = 4;
export const CODEWORD_MAX_PLAYERS = 12;
export const BOARD_SIZE = 25;
export const CLUE_WORD_MAX = 12;

export const otherTeam = (t: CodewordTeam): CodewordTeam => (t === 'RED' ? 'BLUE' : 'RED');
export const TEAM_NAME: Record<CodewordTeam, string> = { RED: '紅隊', BLUE: '藍隊' };

// ───────── 初始狀態 ─────────

export function createInitialCodewordState(config?: CodewordConfig): CodewordState {
  return {
    phase: 'LOBBY',
    config: config ?? { clueTime: 90 },
    round: 0,
    teams: {},
    captains: { RED: null, BLUE: null },
    board: [],
    startTeam: 'RED',
    turn: 'RED',
    clue: null,
    guessesUsed: 0,
    proposals: {},
    turnStartedAt: 0,
    history: [],
    winner: null,
    winReason: ''
  };
}

// ───────── 小工具 ─────────

const isBotId = (room: CodewordHostRoom, id: string) => !!room.players.find(p => p.id === id)?.isBot;

function membersOf(room: CodewordHostRoom, team: CodewordTeam) {
  return room.players.filter(p => room.gameState.teams[p.id] === team);
}

function guessersOf(room: CodewordHostRoom, team: CodewordTeam) {
  const cap = room.gameState.captains[team];
  return membersOf(room, team).filter(p => p.id !== cap);
}

export function maxGuessesOf(clue: CodewordState['clue']): number | null {
  if (!clue || clue.number === 'INF' || clue.number === 0) return null;
  return clue.number + 1;
}

function remainingOf(board: CodewordCard[], team: CodewordTeam) {
  return board.filter(c => c.color === team && !c.revealed).length;
}

// 新加入／換局時，把還沒選隊的人補到人數較少的一隊
function assignUnassigned(room: CodewordHostRoom) {
  const s = room.gameState;
  for (const p of room.players) {
    if (s.teams[p.id]) continue;
    const red = membersOf(room, 'RED').length;
    const blue = membersOf(room, 'BLUE').length;
    s.teams[p.id] = red <= blue ? 'RED' : 'BLUE';
  }
}

function pickCaptains(room: CodewordHostRoom) {
  const s = room.gameState;
  for (const t of ['RED', 'BLUE'] as CodewordTeam[]) {
    const cap = s.captains[t];
    const ok = cap && s.teams[cap] === t && !isBotId(room, cap) && room.players.some(p => p.id === cap);
    if (ok) continue;
    const humans = membersOf(room, t).filter(p => !p.isBot);
    s.captains[t] = humans.length > 0 ? shuffle(humans)[0].id : null;
  }
}

function validateStart(room: CodewordHostRoom): string | null {
  const s = room.gameState;
  if (room.players.length < CODEWORD_MIN_PLAYERS) return `至少要 ${CODEWORD_MIN_PLAYERS} 人才能開始`;
  if (room.players.some(p => !s.teams[p.id])) return '還有人沒有選隊伍';
  for (const t of ['RED', 'BLUE'] as CodewordTeam[]) {
    const members = membersOf(room, t);
    if (members.length < 2) return `${TEAM_NAME[t]}至少要 2 人`;
    if (!members.some(p => !p.isBot)) return `${TEAM_NAME[t]}至少要有 1 位真人當隊長`;
  }
  return null;
}

function dealBoard(first: CodewordTeam): CodewordCard[] {
  const words = shuffle(CODEWORD_WORDS).slice(0, BOARD_SIZE);
  const colors: CardColor[] = [
    ...Array<CardColor>(9).fill(first),
    ...Array<CardColor>(8).fill(otherTeam(first)),
    ...Array<CardColor>(7).fill('NEUTRAL'),
    'ASSASSIN'
  ];
  const shuffled = shuffle(colors);
  return words.map((word, i) => ({ word, color: shuffled[i], revealed: false, revealedBy: null }));
}

function startRound(room: CodewordHostRoom): CodewordMutation {
  const err = validateStart(room);
  if (err) return { error: err };
  pickCaptains(room);
  const s = room.gameState;
  const first: CodewordTeam = Math.random() < 0.5 ? 'RED' : 'BLUE';
  s.board = dealBoard(first);
  s.startTeam = first;
  s.turn = first;
  s.phase = 'CLUE';
  s.clue = null;
  s.guessesUsed = 0;
  s.proposals = {};
  s.turnStartedAt = Date.now();
  s.history = [];
  s.winner = null;
  s.winReason = '';
  s.round += 1;
  return { room };
}

function backToLobby(room: CodewordHostRoom) {
  const s = room.gameState;
  s.phase = 'LOBBY';
  s.board = [];
  s.clue = null;
  s.guessesUsed = 0;
  s.proposals = {};
  s.history = [];
  s.winner = null;
  s.winReason = '';
}

// ───────── 回合進行 ─────────

function switchTurn(s: CodewordState) {
  s.turn = otherTeam(s.turn);
  s.phase = 'CLUE';
  s.clue = null;
  s.guessesUsed = 0;
  s.proposals = {};
  s.turnStartedAt = Date.now();
}

function finish(s: CodewordState, winner: CodewordTeam, reason: string) {
  s.phase = 'RESULT';
  s.winner = winner;
  s.winReason = reason;
  s.proposals = {};
}

function revealCard(s: CodewordState, index: number) {
  const card = s.board[index];
  const guessingTeam = s.turn;
  card.revealed = true;
  card.revealedBy = guessingTeam;
  s.guessesUsed += 1;
  s.proposals = {};
  s.history[s.history.length - 1]?.guesses.push({ index, word: card.word, color: card.color });

  if (card.color === 'ASSASSIN') {
    finish(s, otherTeam(guessingTeam), `${TEAM_NAME[guessingTeam]}翻到了刺客！${TEAM_NAME[otherTeam(guessingTeam)]}獲勝`);
    return;
  }
  for (const t of ['RED', 'BLUE'] as CodewordTeam[]) {
    if (remainingOf(s.board, t) === 0) {
      finish(s, t, t === guessingTeam ? `${TEAM_NAME[t]}找出了所有密語！` : `${TEAM_NAME[guessingTeam]}幫對手翻完了最後一張牌，${TEAM_NAME[t]}獲勝`);
      return;
    }
  }
  if (card.color !== guessingTeam) {
    switchTurn(s);
    return;
  }
  const max = maxGuessesOf(s.clue);
  if (max !== null && s.guessesUsed >= max) switchTurn(s);
}

// 某張牌得到該隊隊員過半同意就翻開（只翻一張）
function checkMajority(room: CodewordHostRoom) {
  const s = room.gameState;
  if (s.phase !== 'GUESS') return;
  const guesserIds = new Set(guessersOf(room, s.turn).map(p => p.id));
  const total = guesserIds.size;
  if (total === 0) return;
  const tally = new Map<number, number>();
  for (const [pid, idx] of Object.entries(s.proposals)) {
    if (guesserIds.has(pid)) tally.set(idx, (tally.get(idx) ?? 0) + 1);
  }
  for (const [idx, count] of tally) {
    if (count * 2 > total && s.board[idx] && !s.board[idx].revealed) {
      revealCard(s, idx);
      return;
    }
  }
}

// ───────── 離開／移出 ─────────

// room.players 已經先移除該玩家。對局中的隊長離開由同隊另一位真人接任，沒人可接就中止回大廳
function removeFromGame(room: CodewordHostRoom, playerId: string) {
  const s = room.gameState;
  const team = s.teams[playerId];
  delete s.teams[playerId];
  delete s.proposals[playerId];
  const wasCaptain = (['RED', 'BLUE'] as CodewordTeam[]).find(t => s.captains[t] === playerId);
  if (wasCaptain) s.captains[wasCaptain] = null;
  if (s.phase === 'LOBBY' || s.phase === 'RESULT' || !team) return;

  if (wasCaptain) {
    const successor = membersOf(room, wasCaptain).find(p => !p.isBot);
    if (!successor) {
      backToLobby(room);
      return;
    }
    s.captains[wasCaptain] = successor.id;
    delete s.proposals[successor.id];
  }
  // 兩隊都要至少還有 1 位隊員能猜牌
  if (guessersOf(room, 'RED').length === 0 || guessersOf(room, 'BLUE').length === 0) {
    backToLobby(room);
    return;
  }
  checkMajority(room);
}

// ───────── 操作 ─────────

export function applyCodewordAction(room: CodewordHostRoom, playerId: string, input: CodewordAction): CodewordMutation {
  const s = room.gameState;
  const isHost = room.hostId === playerId;
  const hostOnly = () => ({ error: '只有房主可以進行這個操作' });
  const myTeam = s.teams[playerId];
  const isTurnGuesser = () => s.phase === 'GUESS' && myTeam === s.turn && s.captains[myTeam] !== playerId;
  const validCard = (i: unknown): i is number =>
    typeof i === 'number' && Number.isInteger(i) && !!s.board[i] && !s.board[i].revealed;

  switch (input.action) {
    case 'UPDATE_CONFIG': {
      if (!isHost) return hostOnly();
      if (s.phase !== 'LOBBY') return { error: '開始後不能調整設定' };
      const t = input.config.clueTime;
      if (typeof t === 'number') s.config.clueTime = Math.min(Math.max(0, Math.floor(t)), 600);
      break;
    }

    case 'SET_TEAM': {
      if (s.phase !== 'LOBBY') return { error: '開始後不能換隊' };
      if (input.team !== 'RED' && input.team !== 'BLUE') return { error: '隊伍不存在' };
      const target = input.targetId ?? playerId;
      if (target !== playerId && !isHost) return hostOnly();
      if (!room.players.some(p => p.id === target)) return { error: '找不到這位玩家' };
      if (s.teams[target] !== input.team) {
        s.teams[target] = input.team;
        for (const t of ['RED', 'BLUE'] as CodewordTeam[]) if (s.captains[t] === target) s.captains[t] = null;
      }
      break;
    }

    case 'SET_CAPTAIN': {
      if (s.phase !== 'LOBBY') return { error: '開始後不能換隊長' };
      const target = input.targetId ?? playerId;
      if (target !== playerId && !isHost) return hostOnly();
      const team = s.teams[target];
      if (!team) return { error: '要先選隊伍才能當隊長' };
      if (isBotId(room, target)) return { error: '電腦只能當隊員，隊長必須是真人' };
      s.captains[team] = s.captains[team] === target && !input.targetId ? null : target;
      break;
    }

    case 'SHUFFLE_TEAMS': {
      if (!isHost) return hostOnly();
      if (s.phase !== 'LOBBY') return { error: '開始後不能重新分隊' };
      const order = shuffle(room.players.map(p => p.id));
      const redCount = Math.ceil(order.length / 2);
      s.teams = {};
      order.forEach((id, i) => { s.teams[id] = i < redCount ? 'RED' : 'BLUE'; });
      s.captains = { RED: null, BLUE: null };
      break;
    }

    case 'START': {
      if (!isHost) return hostOnly();
      if (s.phase !== 'LOBBY') return { error: '遊戲已經開始了' };
      return startRound(room);
    }

    case 'GIVE_CLUE': {
      if (s.phase !== 'CLUE') return { error: '現在不是出題時間' };
      if (s.captains[s.turn] !== playerId) return { error: '現在輪到對方隊長出題' };
      const word = typeof input.word === 'string' ? input.word.trim() : '';
      if (word.length < 1 || word.length > CLUE_WORD_MAX) return { error: `提示詞要 1–${CLUE_WORD_MAX} 個字` };
      if (/\s/.test(word)) return { error: '提示詞只能是一個詞，不能有空白' };
      if (s.board.some(c => !c.revealed && c.word.toLowerCase() === word.toLowerCase())) return { error: '提示詞不能是盤面上還沒翻開的詞' };
      const n: ClueNumber = input.number;
      if (n !== 'INF' && !(typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 9)) return { error: '數字要是 0–9 或 ∞' };
      s.clue = { word, number: n };
      s.phase = 'GUESS';
      s.guessesUsed = 0;
      s.proposals = {};
      s.history.push({ team: s.turn, captainId: playerId, word, number: n, guesses: [] });
      break;
    }

    case 'PROPOSE': {
      if (!isTurnGuesser()) return { error: '現在不是你這隊猜牌，或你是隊長' };
      if (!validCard(input.index)) return { error: '這張牌不能選' };
      if (s.proposals[playerId] === input.index) delete s.proposals[playerId];
      else s.proposals[playerId] = input.index;
      checkMajority(room);
      break;
    }

    case 'REVEAL': {
      if (!isTurnGuesser()) return { error: '現在不是你這隊猜牌，或你是隊長' };
      if (!validCard(input.index)) return { error: '這張牌不能選' };
      revealCard(s, input.index);
      break;
    }

    case 'END_GUESS': {
      if (!isTurnGuesser()) return { error: '現在不是你這隊猜牌，或你是隊長' };
      if (s.guessesUsed < 1) return { error: '至少要猜一張牌才能結束' };
      switchTurn(s);
      break;
    }

    case 'NEXT_ROUND': {
      if (!isHost) return hostOnly();
      if (s.phase !== 'RESULT') return { error: '對局還沒結束' };
      assignUnassigned(room);
      if (input.rotateCaptains) {
        for (const t of ['RED', 'BLUE'] as CodewordTeam[]) {
          const humans = membersOf(room, t).filter(p => !p.isBot);
          if (humans.length === 0) continue;
          const at = humans.findIndex(p => p.id === s.captains[t]);
          s.captains[t] = humans[(at + 1) % humans.length].id;
        }
      }
      return startRound(room);
    }

    case 'BACK_TO_LOBBY': {
      if (!isHost) return hostOnly();
      backToLobby(room);
      assignUnassigned(room);
      break;
    }

    case 'KICK': {
      if (!isHost) return hostOnly();
      if (input.targetId === playerId) return { error: '不能踢出自己' };
      room.players = room.players.filter(p => p.id !== input.targetId);
      removeFromGame(room, input.targetId);
      break;
    }

    case 'LEAVE': {
      // 房主離開等於解散房間，由連線層處理
      if (isHost) return { error: '房主離開會解散房間' };
      room.players = room.players.filter(p => p.id !== playerId);
      removeFromGame(room, playerId);
      break;
    }

    default:
      return { error: '未知的操作指令' };
  }

  return { room };
}

// 新玩家加入或舊玩家重新連線；大廳加入的人先補到人數較少的一隊，對局中加入的人當旁觀者
export function addCodewordPlayer(room: CodewordHostRoom, player: { id: string; name: string; secret: string }): CodewordMutation {
  const result = addPeerPlayer(room, player, CODEWORD_MAX_PLAYERS);
  if ('room' in result && result.room.gameState.phase === 'LOBBY') assignUnassigned(result.room);
  return result;
}

// ───────── 視角 ─────────

export function buildCodewordView(room: CodewordHostRoom, playerId: string, onlineIds: Set<string>): CodewordRoomView {
  const s = room.gameState;
  const me = room.players.find(p => p.id === playerId);
  const myTeam = s.teams[playerId] ?? null;
  const inGame = s.phase === 'CLUE' || s.phase === 'GUESS' || s.phase === 'RESULT';
  const isCaptain = !!myTeam && s.captains[myTeam] === playerId;
  const myRole: CodewordRole = !myTeam || !inGame ? 'SPECTATOR' : isCaptain ? 'CAPTAIN' : 'GUESSER';
  const seeAll = s.phase === 'RESULT' || (isCaptain && inGame);

  const board = s.board.map((c, index) => ({
    index,
    word: c.word,
    revealed: c.revealed,
    revealedBy: c.revealedBy,
    ...(c.revealed || seeAll ? { color: c.color } : {})
  }));

  return {
    roomId: room.id,
    version: room.version,
    serverNow: Date.now(),
    hostId: room.hostId,
    me: { id: playerId, name: me?.name || '', isHost: room.hostId === playerId },
    players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, online: p.isBot ? true : onlineIds.has(p.id) })),
    phase: s.phase,
    config: s.config,
    round: s.round,
    members: room.players.map(p => ({
      playerId: p.id,
      name: p.name,
      team: s.teams[p.id] ?? null,
      isCaptain: s.captains.RED === p.id || s.captains.BLUE === p.id,
      isBot: !!p.isBot,
      online: p.isBot ? true : onlineIds.has(p.id)
    })),
    board,
    startTeam: s.startTeam,
    turn: s.turn,
    clue: s.clue,
    guessesUsed: s.guessesUsed,
    maxGuesses: maxGuessesOf(s.clue),
    proposals: s.proposals,
    turnStartedAt: s.turnStartedAt,
    remaining: { RED: remainingOf(s.board, 'RED'), BLUE: remainingOf(s.board, 'BLUE') },
    myTeam,
    myRole,
    history: s.history,
    winner: s.winner,
    winReason: s.winReason
  };
}

export const codewordEngine: PeerGameEngine<CodewordHostRoom, CodewordRoomView, CodewordAction> = {
  codePrefix: 'CDW',
  storageKey: 'codeword',
  createRoom: (id, host) => {
    const state = createInitialCodewordState();
    state.teams[host.id] = 'RED';
    return { id, hostId: host.id, version: 1, players: [host], gameState: state };
  },
  addPlayer: addCodewordPlayer,
  applyAction: applyCodewordAction,
  buildView: buildCodewordView,
  botAction: codewordBotAction
};
