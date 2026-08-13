'use client';

import { useState, useCallback, useMemo } from 'react';
import { Player, Role, Phase, GameConfig, WordPair, VictoryStatus } from '@/types/game';
import { wordManagerInstance } from '@/lib/wordManager';

const AGENT_ICONS = [
  '🕵️‍♂️', '🕵️‍♀️', '🕶️', '👤', '🎩', '🦅', '🦊', '🐺',
  '🦁', '🐯', '🦉', '🐲', '⚡', '🔥', '🔮', '🚀'
];

export function useGameState() {
  const [phase, setPhase] = useState<Phase>('HOME');

  const [config, setConfig] = useState<GameConfig>({
    playerCount: 6,
    spyCount: 1,
    hasBlank: false,
    speechTime: 45,
    showRoleOnEliminated: true,
    difficulties: ['easy', 'medium', 'hard'],
    categories: ['all'],
    playerNames: []
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentWordPair, setCurrentWordPair] = useState<WordPair>({
    civilian: '可口可樂',
    spy: '百事可樂',
    difficulty: 'easy',
    category: '美食飲品'
  });

  const [currentRevealIndex, setCurrentRevealIndex] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [startingSpeakerIndex, setStartingSpeakerIndex] = useState<number>(0);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState<number>(0);
  const [winner, setWinner] = useState<Role | null>(null);

  // 更新遊戲配置
  const updateConfig = useCallback((newConfig: Partial<GameConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // 取得存活特工
  const alivePlayers = useMemo(() => {
    return players.filter(p => p.isAlive);
  }, [players]);

  // 檢查勝負條件
  const checkVictoryCondition = useCallback((currentPlayers: Player[]): VictoryStatus => {
    const alive = currentPlayers.filter(p => p.isAlive);
    const aliveSpies = alive.filter(p => p.role === 'SPY');
    const aliveCivilians = alive.filter(p => p.role === 'CIVILIAN');
    const aliveBlanks = alive.filter(p => p.role === 'BLANK');

    // 1. 間諜全數被淘汰 -> 平民獲勝
    if (aliveSpies.length === 0) {
      if (aliveBlanks.length > 0 && aliveCivilians.length === 0) {
        return { isGameOver: true, winner: 'BLANK', reason: '間諜全滅，白板特工成功偽裝到最後！' };
      }
      return { isGameOver: true, winner: 'CIVILIAN', reason: '所有間諜臥底均已被成功揪出！' };
    }

    // 2. 間諜存活人數 >= 平民存活人數 -> 間諜獲勝
    if (aliveSpies.length >= aliveCivilians.length) {
      return { isGameOver: true, winner: 'SPY', reason: '間諜存活人數已大於或等於平民，掌控特工局！' };
    }

    // 3. 僅剩白板與間諜各1人時
    if (alive.length === 2 && aliveSpies.length === 1 && aliveBlanks.length === 1) {
      return { isGameOver: true, winner: 'BLANK', reason: '白板特工成功生存至最終對決！' };
    }

    return { isGameOver: false, winner: null };
  }, []);

  // 開始全新一局對局
  const startNewGame = useCallback(() => {
    // 抽取題目
    const wordPair = wordManagerInstance.getRandomWordPair({
      difficulties: config.difficulties,
      categories: config.categories,
      includeCustom: true
    });
    setCurrentWordPair(wordPair);

    const total = config.playerCount;
    const spyCount = config.spyCount;
    const hasBlank = config.hasBlank;

    // 分配身分
    const roles: Role[] = [];
    for (let i = 0; i < spyCount; i++) roles.push('SPY');
    if (hasBlank) roles.push('BLANK');
    while (roles.length < total) roles.push('CIVILIAN');

    // Fisher-Yates 洗牌
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // 建立特工陣列
    const newPlayers: Player[] = [];
    for (let i = 0; i < total; i++) {
      const role = roles[i];
      let word = '';
      if (role === 'CIVILIAN') word = wordPair.civilian;
      else if (role === 'SPY') word = wordPair.spy;
      else if (role === 'BLANK') word = '無（你是白板特工，請靠推理偽裝）';

      const customName = config.playerNames[i]?.trim();
      const code = `AGENT ${String(i + 1).padStart(2, '0')}`;

      newPlayers.push({
        id: i,
        code,
        name: customName || code,
        icon: AGENT_ICONS[i % AGENT_ICONS.length],
        role,
        word,
        isAlive: true,
        eliminatedRound: null
      });
    }

    setPlayers(newPlayers);
    setCurrentRevealIndex(0);
    setRound(1);
    setWinner(null);

    // 隨機起手特工
    const randomStart = Math.floor(Math.random() * total);
    setStartingSpeakerIndex(randomStart);
    setCurrentSpeakerIndex(randomStart);
  }, [config]);

  // 下一位傳閱看詞
  const nextReveal = useCallback((): boolean => {
    if (currentRevealIndex + 1 < players.length) {
      setCurrentRevealIndex(prev => prev + 1);
      return true;
    }
    return false;
  }, [currentRevealIndex, players.length]);

  // 取得當前看詞特工
  const getCurrentRevealPlayer = useCallback((): Player | undefined => {
    return players[currentRevealIndex];
  }, [players, currentRevealIndex]);

  // 下一位發言特工
  const nextSpeaker = useCallback((): Player | null => {
    const alive = players.filter(p => p.isAlive);
    if (alive.length === 0) return null;

    let nextIdx = (currentSpeakerIndex + 1) % players.length;
    while (!players[nextIdx].isAlive) {
      nextIdx = (nextIdx + 1) % players.length;
    }
    setCurrentSpeakerIndex(nextIdx);
    return players[nextIdx];
  }, [players, currentSpeakerIndex]);

  // 取得當前發言特工
  const getCurrentSpeaker = useCallback((): Player | undefined => {
    return players[currentSpeakerIndex];
  }, [players, currentSpeakerIndex]);

  // 直接淘汰玩家
  const eliminatePlayerDirectly = useCallback((playerId: number): VictoryStatus => {
    const updatedPlayers = players.map(p => {
      if (p.id === playerId) {
        return { ...p, isAlive: false, eliminatedRound: round };
      }
      return p;
    });

    setPlayers(updatedPlayers);
    const victoryStatus = checkVictoryCondition(updatedPlayers);
    if (victoryStatus.isGameOver) {
      setWinner(victoryStatus.winner);
    }
    return victoryStatus;
  }, [players, round, checkVictoryCondition]);

  // 進入下一輪發言
  const advanceToNextRound = useCallback(() => {
    setRound(prev => prev + 1);
    // 尋找下一位存活特工為起手
    let nextStart = (startingSpeakerIndex + 1) % players.length;
    while (!players[nextStart].isAlive) {
      nextStart = (nextStart + 1) % players.length;
    }
    setStartingSpeakerIndex(nextStart);
    setCurrentSpeakerIndex(nextStart);
  }, [players, startingSpeakerIndex]);

  return {
    phase,
    setPhase,
    config,
    updateConfig,
    players,
    alivePlayers,
    currentWordPair,
    currentRevealIndex,
    round,
    startingSpeakerIndex,
    currentSpeakerIndex,
    winner,
    startNewGame,
    nextReveal,
    getCurrentRevealPlayer,
    nextSpeaker,
    getCurrentSpeaker,
    eliminatePlayerDirectly,
    advanceToNextRound
  };
}
