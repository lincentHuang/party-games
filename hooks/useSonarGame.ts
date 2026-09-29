// hooks/useSonarGame.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  SonarGameState,
  SubmarineDirection,
  GridCoord,
  SonarEventLog
} from '@/types/sonar';
import {
  createInitialSonarGame,
  isIsland,
  coordToString,
  getChebyshevDistance,
  getSector,
  getSectorName
} from '@/lib/sonarUtils';
import { soundManager } from '@/lib/soundManager';

interface UseSonarGameProps {
  myTeam: 'RED' | 'BLUE';
  isVsAi?: boolean;
  onSyncState?: (state: SonarGameState, event?: { type: string; payload: any }) => void;
  externalState?: SonarGameState | null;
}

export function useSonarGame({
  myTeam = 'RED',
  isVsAi = false,
  onSyncState,
  externalState
}: UseSonarGameProps) {
  const [gameState, setGameState] = useState<SonarGameState>(() => externalState || createInitialSonarGame());

  // 同步外部房間狀態
  useEffect(() => {
    if (externalState) {
      setGameState(externalState);
    }
  }, [externalState]);

  const addLog = useCallback((text: string, type: SonarEventLog['type'] = 'INFO') => {
    const newLog: SonarEventLog = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type
    };
    return newLog;
  }, []);

  // 輔助更新並廣播
  const updateAndBroadcast = useCallback((updater: (prev: SonarGameState) => SonarGameState, event?: { type: string; payload: any }) => {
    setGameState(prev => {
      const next = updater(prev);
      if (onSyncState) {
        onSyncState(next, event);
      }
      return next;
    });
  }, [onSyncState]);

  // 1. 移動指令 (北、南、東、西)
  const moveSubmarine = useCallback((dir: SubmarineDirection) => {
    soundManager.playClick();
    updateAndBroadcast(prev => {
      if (prev.phase !== 'PLAYING') return prev;
      const actingTeam = prev.turnTeam;
      const sub = actingTeam === 'RED' ? { ...prev.redSub } : { ...prev.blueSub };

      let nextX = sub.pos.x;
      let nextY = sub.pos.y;
      if (dir === 'NORTH') nextY -= 1;
      if (dir === 'SOUTH') nextY += 1;
      if (dir === 'EAST') nextX += 1;
      if (dir === 'WEST') nextX -= 1;

      // 邊界檢查
      if (nextX < 0 || nextX > 7 || nextY < 0 || nextY > 7) {
        alert('警告：前方為暗礁或邊界邊緣，無法航行！');
        return prev;
      }

      const nextCoord: GridCoord = { x: nextX, y: nextY };

      // 島嶼檢查
      if (isIsland(nextCoord)) {
        alert('警告：前方為島嶼陸地，禁止撞擊！');
        return prev;
      }

      // 檢查自身航跡（不可交叉自撞自身航跡，除非浮出水面重置）
      const hasCrossed = sub.trail.some(t => t.x === nextCoord.x && t.y === nextCoord.y);
      if (hasCrossed) {
        alert('警告：不可穿越自身既有航行軌跡！請選擇其他航向或執行【浮出水面】！');
        return prev;
      }

      // 更新潛艦座標與航跡
      sub.pos = nextCoord;
      sub.trail = [...sub.trail, nextCoord];

      // 各系統充能 +1
      sub.energy = {
        torpedo: Math.min(3, sub.energy.torpedo + 1),
        sonar: Math.min(3, sub.energy.sonar + 1),
        silence: Math.min(4, sub.energy.silence + 1),
        mine: Math.min(3, sub.energy.mine + 1)
      };

      const dirName = dir === 'NORTH' ? '北' : dir === 'SOUTH' ? '南' : dir === 'EAST' ? '東' : '西';
      const logMsg = `【${sub.name}】向 [${dirName}] 潛航至機密座標，系統充能中！`;

      const updatedTeamSub = actingTeam === 'RED' ? { redSub: sub } : { blueSub: sub };
      const nextTurnTeam = actingTeam === 'RED' ? 'BLUE' : 'RED';

      return {
        ...prev,
        ...updatedTeamSub,
        turnTeam: nextTurnTeam,
        roundNumber: prev.roundNumber + 1,
        logs: [addLog(logMsg, 'INFO'), ...prev.logs]
      };
    }, { type: 'MOVE', payload: { dir } });
  }, [updateAndBroadcast, addLog]);

  // 2. 發射魚雷
  const fireTorpedo = useCallback((targetCoord: GridCoord) => {
    soundManager.playClick();
    updateAndBroadcast(prev => {
      if (prev.phase !== 'PLAYING') return prev;
      const actingTeam = prev.turnTeam;
      const attackerSub = actingTeam === 'RED' ? { ...prev.redSub } : { ...prev.blueSub };
      const targetSub = actingTeam === 'RED' ? { ...prev.blueSub } : { ...prev.redSub };

      if (attackerSub.energy.torpedo < 3) {
        alert('魚雷系統尚未充能完畢 (需 3 點能量)！');
        return prev;
      }

      // 檢查發射射程 (最遠 3 格)
      const dist = getChebyshevDistance(attackerSub.pos, targetCoord);
      if (dist > 3) {
        alert('目標座標超出魚雷射程範圍（最大射程 3 格）！');
        return prev;
      }

      attackerSub.energy.torpedo = 0; // 消耗能量

      const targetCoordStr = coordToString(targetCoord);
      const distToEnemy = getChebyshevDistance(targetCoord, targetSub.pos);

      let damage = 0;
      let hitDesc = '';
      let isDirect = false;

      if (distToEnemy === 0) {
        // 直擊！2 點傷害
        damage = 2;
        isDirect = true;
        hitDesc = `🎯 致命直擊！魚雷正中【${targetSub.name}】，造成 2 點重創！`;
        soundManager.playSpyWin();
      } else if (distToEnemy === 1) {
        // 濺射波及！1 點傷害
        damage = 1;
        isDirect = false;
        hitDesc = `💥 水花波及！魚雷在【${targetSub.name}】鄰近引爆，造成 1 點衝擊傷害！`;
        soundManager.playFingerprintPress();
      } else {
        hitDesc = `🌊 魚雷在座標 [${targetCoordStr}] 引爆，但敵艦不在有效爆炸範圍內（未命中）！`;
      }

      targetSub.hp = Math.max(0, targetSub.hp - damage);

      // 檢查是否擊沉勝利
      let winner: 'RED' | 'BLUE' | null = null;
      let phase: SonarGameState['phase'] = prev.phase;
      if (targetSub.hp <= 0) {
        winner = actingTeam;
        phase = 'GAMEOVER';
        soundManager.playWin();
      }

      const nextRed = actingTeam === 'RED' ? attackerSub : targetSub;
      const nextBlue = actingTeam === 'RED' ? targetSub : attackerSub;

      return {
        ...prev,
        phase,
        winnerTeam: winner,
        redSub: nextRed,
        blueSub: nextBlue,
        turnTeam: actingTeam === 'RED' ? 'BLUE' : 'RED',
        lastTorpedoHit: damage > 0 ? { coord: targetCoord, isDirect, hitTeam: targetSub.team } : null,
        logs: [
          addLog(`【${attackerSub.name}】朝座標 [${targetCoordStr}] 發射了魚雷！${hitDesc}`, damage > 0 ? 'HIT' : 'ATTACK'),
          ...prev.logs
        ]
      };
    }, { type: 'FIRE_TORPEDO', payload: { targetCoord } });
  }, [updateAndBroadcast, addLog]);

  // 3. 聲納探測 (Sonar Ping)
  const pingSonar = useCallback(() => {
    soundManager.playClick();
    updateAndBroadcast(prev => {
      if (prev.phase !== 'PLAYING') return prev;
      const actingTeam = prev.turnTeam;
      const attackerSub = actingTeam === 'RED' ? { ...prev.redSub } : { ...prev.blueSub };
      const enemySub = actingTeam === 'RED' ? prev.blueSub : prev.redSub;

      if (attackerSub.energy.sonar < 3) {
        alert('聲納系統尚未充能完畢 (需 3 點能量)！');
        return prev;
      }

      attackerSub.energy.sonar = 0;

      // 聲納探測回傳敵艦所在區域與行列資訊
      const sector = getSector(enemySub.pos);
      const sectorName = getSectorName(sector);
      const colLetter = String.fromCharCode(65 + enemySub.pos.x);

      const intelMsg = `📡 聲納探測回傳訊號：敵方潛艦目前位於【${sectorName}】，且艦身訊號穿梭於 [${colLetter} 縱列]！`;

      const nextRed = actingTeam === 'RED' ? attackerSub : prev.redSub;
      const nextBlue = actingTeam === 'BLUE' ? attackerSub : prev.blueSub;

      return {
        ...prev,
        redSub: nextRed,
        blueSub: nextBlue,
        turnTeam: actingTeam === 'RED' ? 'BLUE' : 'RED',
        logs: [addLog(`【${attackerSub.name}】啟動了全頻道聲納探測！${intelMsg}`, 'SONAR'), ...prev.logs]
      };
    }, { type: 'SONAR', payload: {} });
  }, [updateAndBroadcast, addLog]);

  // 4. 浮出水面 (Surface)
  const surfaceSub = useCallback(() => {
    soundManager.playClick();
    updateAndBroadcast(prev => {
      if (prev.phase !== 'PLAYING') return prev;
      const actingTeam = prev.turnTeam;
      const sub = actingTeam === 'RED' ? { ...prev.redSub } : { ...prev.blueSub };

      // 浮出水面清空自身航跡
      sub.trail = [sub.pos];
      const sector = getSector(sub.pos);
      const sectorName = getSectorName(sector);

      const logMsg = `🚨 警告！【${sub.name}】緊急浮出水面換氣並修復軌跡！敵方雷達已鎖定其現身於【${sectorName}】！`;

      const nextRed = actingTeam === 'RED' ? sub : prev.redSub;
      const nextBlue = actingTeam === 'BLUE' ? sub : prev.blueSub;

      return {
        ...prev,
        redSub: nextRed,
        blueSub: nextBlue,
        turnTeam: actingTeam === 'RED' ? 'BLUE' : 'RED',
        logs: [addLog(logMsg, 'SURFACE'), ...prev.logs]
      };
    }, { type: 'SURFACE', payload: {} });
  }, [updateAndBroadcast, addLog]);

  // AI 幽靈艦長自動行動 (當啟用 vs AI 且輪到 BLUE 回合時)
  useEffect(() => {
    if (!isVsAi || gameState.phase !== 'PLAYING' || gameState.turnTeam !== 'BLUE') return;

    const timer = setTimeout(() => {
      const aiSub = gameState.blueSub;
      const playerSub = gameState.redSub;

      // 1. 若魚雷滿能且距離玩家 3 格內，優先發射魚雷！
      if (aiSub.energy.torpedo >= 3) {
        const dist = getChebyshevDistance(aiSub.pos, playerSub.pos);
        if (dist <= 3) {
          fireTorpedo(playerSub.pos);
          return;
        }
      }

      // 2. 否則嘗試安全航行
      const directions: SubmarineDirection[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
      // 隨機打亂方向
      directions.sort(() => Math.random() - 0.5);

      let moved = false;
      for (const dir of directions) {
        let nx = aiSub.pos.x;
        let ny = aiSub.pos.y;
        if (dir === 'NORTH') ny -= 1;
        if (dir === 'SOUTH') ny += 1;
        if (dir === 'EAST') nx += 1;
        if (dir === 'WEST') nx += 1;

        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
          const nextCoord = { x: nx, y: ny };
          if (!isIsland(nextCoord) && !aiSub.trail.some(t => t.x === nx && t.y === ny)) {
            moveSubmarine(dir);
            moved = true;
            break;
          }
        }
      }

      // 3. 若無路可走則浮出水面
      if (!moved) {
        surfaceSub();
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [isVsAi, gameState.phase, gameState.turnTeam, gameState.blueSub, gameState.redSub, fireTorpedo, moveSubmarine, surfaceSub]);

  // 重啟對戰
  const resetGame = useCallback(() => {
    soundManager.playClick();
    const newGame = createInitialSonarGame();
    updateAndBroadcast(() => newGame, { type: 'RESET', payload: {} });
  }, [updateAndBroadcast]);

  return {
    gameState,
    mySub: myTeam === 'RED' ? gameState.redSub : gameState.blueSub,
    enemySub: myTeam === 'RED' ? gameState.blueSub : gameState.redSub,
    isMyTurn: gameState.turnTeam === myTeam,
    moveSubmarine,
    fireTorpedo,
    pingSonar,
    surfaceSub,
    resetGame
  };
}
