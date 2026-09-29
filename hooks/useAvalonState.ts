// hooks/useAvalonState.ts
'use client';

import { useState, useCallback } from 'react';
import {
  AvalonConfig,
  AvalonPlayer,
  AvalonPhase,
  QuestInfo,
  VoteRecord,
  AvalonAlignment
} from '@/types/avalon';
import { dealAvalonRoles, generateQuests } from '@/lib/avalonRules';
import { soundManager } from '@/lib/soundManager';

export function useAvalonState() {
  const [config, setConfig] = useState<AvalonConfig>({
    playerCount: 5,
    usePercival: true,
    useMorgana: true,
    useMordred: false,
    useOberon: false,
    playerNames: ['亞瑟', '蘭斯洛特', '高文', '莫甘娜', '莫德雷德']
  });

  const [phase, setPhase] = useState<AvalonPhase>('SETUP');
  const [players, setPlayers] = useState<AvalonPlayer[]>([]);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);

  const [quests, setQuests] = useState<QuestInfo[]>([]);
  const [currentQuestIndex, setCurrentQuestIndex] = useState(0);
  const [currentLeaderIndex, setCurrentLeaderIndex] = useState(0);

  // 當前遠征指派隊員 ID 陣列
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);

  // 投票記錄 (贊成/反對)
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);
  const [consecutiveFailedVotes, setConsecutiveFailedVotes] = useState(0);

  // 任務執行卡片 (匿名洗牌: true=成功, false=失敗)
  const [questCards, setQuestCards] = useState<boolean[]>([]);

  // 刺客目標
  const [assassinTargetId, setAssassinTargetId] = useState<string | null>(null);

  // 最終勝者與原因
  const [winner, setWinner] = useState<AvalonAlignment | null>(null);
  const [winReason, setWinReason] = useState<string>('');

  // 歷程日誌
  const [gameLogs, setGameLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setGameLogs(prev => [msg, ...prev]);
  }, []);

  // 開始新局
  const startNewGame = useCallback(() => {
    soundManager.playClick();
    const dealtPlayers = dealAvalonRoles(config);
    const newQuests = generateQuests(config.playerCount);

    setPlayers(dealtPlayers);
    setQuests(newQuests);
    setCurrentRevealIndex(0);
    setCurrentQuestIndex(0);
    setCurrentLeaderIndex(0);
    setSelectedTeam([]);
    setVoteRecords([]);
    setConsecutiveFailedVotes(0);
    setQuestCards([]);
    setAssassinTargetId(null);
    setWinner(null);
    setWinReason('');
    setGameLogs(['遊戲開始！亞瑟王圓桌騎士集結完畢。']);

    setPhase('ROLE_REVEAL');
  }, [config]);

  // 單機傳閱看身份
  const nextReveal = useCallback(() => {
    soundManager.playClick();
    if (currentRevealIndex + 1 < players.length) {
      setCurrentRevealIndex(prev => prev + 1);
    } else {
      // 全員看完，進入第一次組隊
      setPhase('TEAM_PROPOSE');
      addLog(`第 1 輪任務開始，領袖 ${players[0]?.name} 正在挑選遠征隊員。`);
    }
  }, [currentRevealIndex, players, addLog]);

  // 領袖切換隊員勾選
  const toggleTeamMember = useCallback((playerId: string) => {
    soundManager.playClick();
    const currentQuest = quests[currentQuestIndex];
    if (!currentQuest) return;

    setSelectedTeam(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      } else {
        if (prev.length >= currentQuest.requiredPlayers) {
          // 已滿人數不增加
          return prev;
        }
        return [...prev, playerId];
      }
    });
  }, [quests, currentQuestIndex]);

  // 領袖確認隊伍，進入全員投票
  const confirmTeamProposal = useCallback(() => {
    soundManager.playClick();
    setVoteRecords([]);
    setPhase('TEAM_VOTE');
    addLog(`領袖提議由 [${selectedTeam.map(id => players.find(p => p.id === id)?.name).join('、')}] 出征，全員開始表決！`);
  }, [selectedTeam, players, addLog]);

  // 提交全體投票結果 (或者單機逐人投票 / 一鍵投票)
  const submitVotes = useCallback((votes: { voterId: string; approve: boolean }[]) => {
    soundManager.playVoteSuccess();
    const records: VoteRecord[] = votes.map(v => ({
      voterId: v.voterId,
      voterName: players.find(p => p.id === v.voterId)?.name || '玩家',
      approve: v.approve
    }));

    setVoteRecords(records);
    setPhase('VOTE_RESULT');

    const approveCount = records.filter(r => r.approve).length;
    const isApproved = approveCount > records.length / 2;

    if (isApproved) {
      setConsecutiveFailedVotes(0);
      addLog(`投票通過（贊成 ${approveCount} 票 / 反對 ${records.length - approveCount} 票），遠征隊伍出發！`);
    } else {
      const nextFailCount = consecutiveFailedVotes + 1;
      setConsecutiveFailedVotes(nextFailCount);
      addLog(`投票遭到否決（贊成 ${approveCount} 票 / 反對 ${records.length - approveCount} 票），連續流局次數：${nextFailCount}/5。`);

      if (nextFailCount >= 5) {
        // 連續 5 次流局，邪惡方直接勝利！
        setWinner('EVIL');
        setWinReason('圓桌騎士信任崩潰，連續 5 次組隊表決失敗，邪惡陣營直接奪勝！');
        setPhase('RESULT');
      }
    }
  }, [players, consecutiveFailedVotes, addLog]);

  // 投票結果後續處置
  const advanceFromVoteResult = useCallback(() => {
    soundManager.playClick();
    const approveCount = voteRecords.filter(r => r.approve).length;
    const isApproved = approveCount > voteRecords.length / 2;

    if (isApproved) {
      // 進入任務出征卡提交
      setQuestCards([]);
      setPhase('QUEST_EXECUTION');
    } else {
      // 領袖順延一位，回到組隊階段
      setCurrentLeaderIndex(prev => (prev + 1) % players.length);
      setSelectedTeam([]);
      setPhase('TEAM_PROPOSE');
    }
  }, [voteRecords, players.length]);

  // 出征隊員投下卡片 (true=成功, false=失敗)
  const submitQuestCard = useCallback((success: boolean) => {
    soundManager.playClick();
    setQuestCards(prev => {
      const nextCards = [...prev, success];
      // 若已集齊全隊出征卡
      const currentQuest = quests[currentQuestIndex];
      if (nextCards.length === currentQuest.requiredPlayers) {
        // 匿名洗牌 (Fisher-Yates)
        const shuffled = [...nextCards];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const failCount = shuffled.filter(c => !c).length;
        const isSuccess = currentQuest.requiresTwoFails ? failCount < 2 : failCount === 0;

        // 更新任務狀態
        setQuests(qList => qList.map((q, idx) => {
          if (idx === currentQuestIndex) {
            return {
              ...q,
              status: isSuccess ? 'SUCCESS' : 'FAILED',
              successCount: shuffled.filter(c => c).length,
              failCount
            };
          }
          return q;
        }));

        if (isSuccess) {
          soundManager.playWin();
          addLog(`第 ${currentQuestIndex + 1} 次遠征獲得【大獲全勝】！`);
        } else {
          soundManager.playSpyWin();
          addLog(`第 ${currentQuestIndex + 1} 次遠征【遭到破壞】！（出現 ${failCount} 張失敗牌）`);
        }

        setPhase('QUEST_RESULT');
      }
      return nextCards;
    });
  }, [quests, currentQuestIndex, addLog]);

  // 任務結果後結算輪次
  const advanceFromQuestResult = useCallback(() => {
    soundManager.playClick();
    const updatedQuests = [...quests];
    const goodWins = updatedQuests.filter(q => q.status === 'SUCCESS').length;
    const evilWins = updatedQuests.filter(q => q.status === 'FAILED').length;

    if (evilWins >= 3) {
      setWinner('EVIL');
      setWinReason('邪惡勢力成功破壞了 3 次聖杯遠征，亞瑟王國度覆滅！');
      setPhase('RESULT');
      return;
    }

    if (goodWins >= 3) {
      // 好人完成 3 次任務，進入刺客刺殺梅林階段！
      setPhase('ASSASSINATION');
      addLog('正義陣營已完成 3 次遠征！進入最後刺殺時刻，邪惡刺客請現身！');
      return;
    }

    // 尚未分出勝負，進入下一輪任務
    setCurrentQuestIndex(prev => prev + 1);
    setCurrentLeaderIndex(prev => (prev + 1) % players.length);
    setSelectedTeam([]);
    setVoteRecords([]);
    setQuestCards([]);
    setPhase('TEAM_PROPOSE');
  }, [quests, players.length, addLog]);

  // 刺客刺殺目標
  const executeAssassination = useCallback((targetPlayerId: string) => {
    soundManager.playClick();
    setAssassinTargetId(targetPlayerId);

    const targetPlayer = players.find(p => p.id === targetPlayerId);
    if (targetPlayer?.role === 'MERLIN') {
      soundManager.playSpyWin();
      setWinner('EVIL');
      setWinReason(`刺客成功精準刺殺了真正的梅林先知（${targetPlayer.name}）！邪惡陣營完成終極逆轉勝！`);
      addLog(`刺客刺殺命中梅林【${targetPlayer.name}】，邪惡陣營逆轉勝利！`);
    } else {
      soundManager.playWin();
      setWinner('GOOD');
      setWinReason(`刺客刺殺失手！目標（${targetPlayer?.name || '目標'}）並非梅林！正義陣營獲得最終光榮勝利！`);
      addLog(`刺客刺殺失手，正義之光永照亞瑟王國度！`);
    }
    setPhase('RESULT');
  }, [players, addLog]);

  return {
    config,
    setConfig,
    phase,
    setPhase,
    players,
    currentRevealIndex,
    quests,
    currentQuestIndex,
    currentLeaderIndex,
    selectedTeam,
    voteRecords,
    consecutiveFailedVotes,
    questCards,
    assassinTargetId,
    winner,
    winReason,
    gameLogs,
    startNewGame,
    nextReveal,
    toggleTeamMember,
    confirmTeamProposal,
    submitVotes,
    advanceFromVoteResult,
    submitQuestCard,
    advanceFromQuestResult,
    executeAssassination
  };
}
