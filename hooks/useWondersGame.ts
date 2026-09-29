// hooks/useWondersGame.ts
'use client';

import { useState, useCallback } from 'react';
import {
  WondersGameState,
  WonderPlayer,
  WonderCard,
  ScoreSummary
} from '@/types/wonders';
import {
  WONDER_BOARDS,
  dealAgeCards,
  canAffordCard,
  canAffordWonderStage,
  calculateScores
} from '@/lib/wondersData';
import { soundManager } from '@/lib/soundManager';

export function useWondersGame() {
  const [gameState, setGameState] = useState<WondersGameState>(() => {
    // 預設 3 人局 (玩家 + 2 位 AI 領袖)
    const p1: WonderPlayer = {
      id: 'wonder_p1',
      name: '你 (總督)',
      isAi: false,
      wonder: { ...WONDER_BOARDS[0], stages: WONDER_BOARDS[0].stages.map(s => ({ ...s })) },
      coins: 3,
      builtCards: [],
      militaryTokens: [],
      hand: []
    };
    const p2: WonderPlayer = {
      id: 'wonder_p2',
      name: '亞歷山大王',
      isAi: true,
      wonder: { ...WONDER_BOARDS[1], stages: WONDER_BOARDS[1].stages.map(s => ({ ...s })) },
      coins: 3,
      builtCards: [],
      militaryTokens: [],
      hand: []
    };
    const p3: WonderPlayer = {
      id: 'wonder_p3',
      name: '尼布甲尼撒',
      isAi: true,
      wonder: { ...WONDER_BOARDS[2], stages: WONDER_BOARDS[2].stages.map(s => ({ ...s })) },
      coins: 3,
      builtCards: [],
      militaryTokens: [],
      hand: []
    };

    const initialHands = dealAgeCards(1, 3);
    p1.hand = initialHands[0];
    p2.hand = initialHands[1];
    p3.hand = initialHands[2];

    return {
      phase: 'DRAFTING',
      age: 1,
      turnInAge: 1,
      players: [p1, p2, p3],
      conflictResults: null,
      logs: ['古代文明七大奇蹟崛起！第一時代輪抽正式開啟。']
    };
  });

  const [scores, setScores] = useState<ScoreSummary[] | null>(null);

  // 玩家確認本回合出牌決策
  const confirmPlayerDraft = useCallback((
    cardId: string,
    action: 'BUILD' | 'WONDER' | 'DISCARD'
  ) => {
    soundManager.playClick();
    setGameState(prev => {
      if (prev.phase !== 'DRAFTING') return prev;

      const updatedPlayers: WonderPlayer[] = prev.players.map(p => {
        if (!p.isAi) {
          return {
            ...p,
            selectedCardId: cardId,
            selectedAction: action
          };
        } else {
          // AI 自動選擇邏輯
          const affordableCard = p.hand.find(c => canAffordCard(p, c));
          const canWonder = canAffordWonderStage(p);

          let aiAction: 'BUILD' | 'WONDER' | 'DISCARD' = 'DISCARD';
          let aiCard = p.hand[0];

          if (canWonder && Math.random() > 0.6) {
            aiAction = 'WONDER';
            aiCard = p.hand[0];
          } else if (affordableCard) {
            aiAction = 'BUILD';
            aiCard = affordableCard;
          }

          return {
            ...p,
            selectedCardId: aiCard.id,
            selectedAction: aiAction
          };
        }
      });

      // 結算所有玩家本輪選擇
      for (const p of updatedPlayers) {
        const chosenCard = p.hand.find(c => c.id === p.selectedCardId);
        if (!chosenCard) continue;

        if (p.selectedAction === 'BUILD') {
          p.builtCards.push(chosenCard);
          if (chosenCard.cost.coins) p.coins -= chosenCard.cost.coins;
          if (chosenCard.provides.coins) p.coins += chosenCard.provides.coins;
        } else if (p.selectedAction === 'WONDER') {
          const nextStage = p.wonder.stages.find(s => !s.completed);
          if (nextStage) {
            nextStage.completed = true;
            if (nextStage.coins) p.coins += nextStage.coins;
          }
        } else if (p.selectedAction === 'DISCARD') {
          p.coins += 3;
        }

        // 從手中移除此張牌
        p.hand = p.hand.filter(c => c.id !== p.selectedCardId);
        p.selectedCardId = null;
        p.selectedAction = null;
      }

      // 檢查是否已完成當前時代 6 回合輪抽
      if (prev.turnInAge >= 6) {
        // 進入時代末軍事衝突結算 (Military Conflict)
        const ageVictoryPoints = prev.age === 1 ? 1 : prev.age === 2 ? 3 : 5;
        const count = updatedPlayers.length;

        const summaries = updatedPlayers.map((p, idx) => {
          // 計算當前玩家總軍力 (紅牌盾牌 + 奇蹟盾牌)
          let shields = p.builtCards
            .filter(c => c.category === 'MILITARY')
            .reduce((sum, c) => sum + (c.provides.shields || 0), 0);
          for (const s of p.wonder.stages) {
            if (s.completed && s.shields) shields += s.shields;
          }

          // 左右鄰國
          const leftPlayer = updatedPlayers[(idx - 1 + count) % count];
          const rightPlayer = updatedPlayers[(idx + 1) % count];

          let leftShields = leftPlayer.builtCards.filter(c => c.category === 'MILITARY').reduce((s, c) => s + (c.provides.shields || 0), 0);
          for (const s of leftPlayer.wonder.stages) { if (s.completed && s.shields) leftShields += s.shields; }

          let rightShields = rightPlayer.builtCards.filter(c => c.category === 'MILITARY').reduce((s, c) => s + (c.provides.shields || 0), 0);
          for (const s of rightPlayer.wonder.stages) { if (s.completed && s.shields) rightShields += s.shields; }

          let tokenDelta = 0;
          // vs Left
          if (shields > leftShields) { p.militaryTokens.push(ageVictoryPoints); tokenDelta += ageVictoryPoints; }
          else if (shields < leftShields) { p.militaryTokens.push(-1); tokenDelta -= 1; }

          // vs Right
          if (shields > rightShields) { p.militaryTokens.push(ageVictoryPoints); tokenDelta += ageVictoryPoints; }
          else if (shields < rightShields) { p.militaryTokens.push(-1); tokenDelta -= 1; }

          return {
            playerId: p.id,
            playerName: p.name,
            shields,
            diffLeft: shields - leftShields,
            diffRight: shields - rightShields,
            tokenDelta
          };
        });

        soundManager.playSpyWin();
        return {
          ...prev,
          phase: 'CONFLICT',
          players: updatedPlayers,
          conflictResults: {
            age: prev.age,
            summaries
          },
          logs: [`第 ${prev.age} 時代結束，左右鄰邦爆發軍事衝突！`, ...prev.logs]
        };
      }

      // 輪替手牌 (傳遞給鄰國：時代 1 & 3 順時鐘，時代 2 逆時鐘)
      const count = updatedPlayers.length;
      const oldHands = updatedPlayers.map(p => p.hand);
      for (let i = 0; i < count; i++) {
        if (prev.age === 2) {
          // 逆時針
          updatedPlayers[i].hand = oldHands[(i + 1) % count];
        } else {
          // 順時針
          updatedPlayers[i].hand = oldHands[(i - 1 + count) % count];
        }
      }

      return {
        ...prev,
        turnInAge: prev.turnInAge + 1,
        players: updatedPlayers,
        logs: [`完成第 ${prev.turnInAge} 回合輪抽，手牌傳遞給鄰國！`, ...prev.logs]
      };
    });
  }, []);

  // 從軍事衝突結算推進至下個時代或終局
  const advanceFromConflict = useCallback(() => {
    soundManager.playClick();
    setGameState(prev => {
      if (prev.age >= 3) {
        // 遊戲結束，計算總分！
        soundManager.playWin();
        const finalScores = calculateScores(prev.players);
        setScores(finalScores);
        return {
          ...prev,
          phase: 'GAMEOVER',
          conflictResults: null,
          logs: ['三大時代文明建設終局，最終文明積分揭曉！', ...prev.logs]
        };
      }

      // 進入下一個時代
      const nextAge = (prev.age + 1) as 2 | 3;
      const newHands = dealAgeCards(nextAge, prev.players.length);

      const nextPlayers = prev.players.map((p, idx) => ({
        ...p,
        hand: newHands[idx]
      }));

      return {
        ...prev,
        phase: 'DRAFTING',
        age: nextAge,
        turnInAge: 1,
        players: nextPlayers,
        conflictResults: null,
        logs: [`歡迎踏入第 ${nextAge} 時代，全新時代卡牌發放！`, ...prev.logs]
      };
    });
  }, []);

  // 重啟遊戲
  const resetGame = useCallback(() => {
    soundManager.playClick();
    const initialHands = dealAgeCards(1, 3);
    const p1: WonderPlayer = {
      id: 'wonder_p1',
      name: '你 (總督)',
      isAi: false,
      wonder: { ...WONDER_BOARDS[0], stages: WONDER_BOARDS[0].stages.map(s => ({ ...s })) },
      coins: 3,
      builtCards: [],
      militaryTokens: [],
      hand: initialHands[0]
    };
    const p2: WonderPlayer = {
      id: 'wonder_p2',
      name: '亞歷山大王',
      isAi: true,
      wonder: { ...WONDER_BOARDS[1], stages: WONDER_BOARDS[1].stages.map(s => ({ ...s })) },
      coins: 3,
      builtCards: [],
      militaryTokens: [],
      hand: initialHands[1]
    };
    const p3: WonderPlayer = {
      id: 'wonder_p3',
      name: '尼布甲尼撒',
      isAi: true,
      wonder: { ...WONDER_BOARDS[2], stages: WONDER_BOARDS[2].stages.map(s => ({ ...s })) },
      coins: 3,
      builtCards: [],
      militaryTokens: [],
      hand: initialHands[2]
    };

    setGameState({
      phase: 'DRAFTING',
      age: 1,
      turnInAge: 1,
      players: [p1, p2, p3],
      conflictResults: null,
      logs: ['重啟全新文明征途！第一時代開啟。']
    });
    setScores(null);
  }, []);

  return {
    gameState,
    humanPlayer: gameState.players.find(p => !p.isAi) || gameState.players[0],
    scores,
    confirmPlayerDraft,
    advanceFromConflict,
    resetGame
  };
}
