// lib/avalonRules.ts
import { AvalonRole, AvalonAlignment, AvalonPlayer, AvalonConfig, QuestInfo } from '@/types/avalon';

export const ROLE_INFO: Record<AvalonRole, { name: string; alignment: AvalonAlignment; desc: string; icon: string }> = {
  MERLIN: {
    name: '梅林',
    alignment: 'GOOD',
    desc: '正義先知。知曉除莫德雷德以外的所有邪惡方身份；必須隱藏自己的智者身份，避免在終局被刺客刺殺。',
    icon: '🧙‍♂️'
  },
  PERCIVAL: {
    name: '派西維爾',
    alignment: 'GOOD',
    desc: '圓桌榮譽騎士。知曉誰是梅林與莫甘娜，但無法分辨兩人誰真誰假，須全力護航梅林。',
    icon: '🛡️'
  },
  SERVANT: {
    name: '亞瑟的忠臣',
    alignment: 'GOOD',
    desc: '效忠亞瑟王的光明騎士。無特殊夜間視野，依賴發言、邏輯與投票推敲正義同盟。',
    icon: '⚔️'
  },
  ASSASSIN: {
    name: '刺客',
    alignment: 'EVIL',
    desc: '暗影刺客。知曉邪惡同伴。若好人完成三輪任務，刺客擁有最後刺殺梅林的機會，刺殺成功即可反敗為勝！',
    icon: '🗡️'
  },
  MORGANA: {
    name: '莫甘娜',
    alignment: 'EVIL',
    desc: '魅惑魔女。在派西維爾眼中會偽裝成梅林，企圖誘導好人走向毀滅。',
    icon: '🦹‍♀️'
  },
  MORDRED: {
    name: '莫德雷德',
    alignment: 'EVIL',
    desc: '叛國邪神首領。身份隱蔽，即便梅林也無法看穿莫德雷德的邪惡身份。',
    icon: '👿'
  },
  MINION: {
    name: '莫德雷德的爪牙',
    alignment: 'EVIL',
    desc: '普通的邪惡爪牙。沒有特殊能力，認得其他邪惡同夥（奧伯倫除外），一起破壞任務。',
    icon: '😈'
  },
  OBERON: {
    name: '奧伯倫',
    alignment: 'EVIL',
    desc: '迷茫妖精。雖然屬於邪惡陣營，但不與其他邪惡同伴相認，但會被梅林看見。',
    icon: '🧚'
  }
};

// 官方 5-10 人任務配置表
export const QUEST_CONFIG_BY_PLAYERS: Record<number, number[]> = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4], // 第4局需2張失敗
  8: [3, 4, 4, 5, 5], // 第4局需2張失敗
  9: [3, 4, 4, 5, 5], // 第4局需2張失敗
  10: [3, 4, 4, 5, 5] // 第4局需2張失敗
};

// 官方 5-10 人陣營人數
export const ALIGNMENT_COUNT_BY_PLAYERS: Record<number, { good: number; evil: number }> = {
  5: { good: 3, evil: 2 },
  6: { good: 4, evil: 2 },
  7: { good: 4, evil: 3 },
  8: { good: 5, evil: 3 },
  9: { good: 6, evil: 3 },
  10: { good: 6, evil: 4 }
};

export function generateQuests(playerCount: number): QuestInfo[] {
  const counts = QUEST_CONFIG_BY_PLAYERS[playerCount] || [2, 3, 2, 3, 3];
  return counts.map((num, idx) => ({
    round: idx + 1,
    requiredPlayers: num,
    requiresTwoFails: playerCount >= 7 && idx === 3,
    status: 'PENDING'
  }));
}

// 發牌配置生成器
export function dealAvalonRoles(config: AvalonConfig): AvalonPlayer[] {
  const count = config.playerCount;
  const alignment = ALIGNMENT_COUNT_BY_PLAYERS[count] || { good: 3, evil: 2 };

  // 1. 組建正義陣營角色
  const goodRoles: AvalonRole[] = ['MERLIN'];
  if (config.usePercival) goodRoles.push('PERCIVAL');
  while (goodRoles.length < alignment.good) {
    goodRoles.push('SERVANT');
  }

  // 2. 組建邪惡陣營角色
  const evilRoles: AvalonRole[] = ['ASSASSIN'];
  if (config.useMorgana && evilRoles.length < alignment.evil) evilRoles.push('MORGANA');
  if (config.useMordred && evilRoles.length < alignment.evil) evilRoles.push('MORDRED');
  if (config.useOberon && evilRoles.length < alignment.evil) evilRoles.push('OBERON');
  while (evilRoles.length < alignment.evil) {
    // 補滿名額用普通爪牙
    evilRoles.push('MINION');
  }

  const allRoles: { role: AvalonRole; alignment: AvalonAlignment }[] = [
    ...goodRoles.map(r => ({ role: r, alignment: 'GOOD' as AvalonAlignment })),
    ...evilRoles.map(r => ({ role: r, alignment: 'EVIL' as AvalonAlignment }))
  ];

  // 洗牌 (Fisher-Yates)
  for (let i = allRoles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allRoles[i], allRoles[j]] = [allRoles[j], allRoles[i]];
  }

  return allRoles.map((item, idx) => ({
    id: `avalon_p_${idx + 1}`,
    name: config.playerNames[idx] || `玩家 ${idx + 1}`,
    role: item.role,
    alignment: item.alignment,
    isLeader: idx === 0 // 初始第 1 位玩家為領袖
  }));
}

// 計算每位玩家能看到的夜間視野 (Visions)
export function getPlayerVisions(player: AvalonPlayer, allPlayers: AvalonPlayer[]): string[] {
  const visions: string[] = [];

  switch (player.role) {
    case 'MERLIN': {
      // 梅林看見除莫德雷德之外的邪惡方
      const evilsSeen = allPlayers.filter(p =>
        p.alignment === 'EVIL' && p.role !== 'MORDRED'
      );
      visions.push(`你身為先知，感知到以下邪惡勢力：${evilsSeen.map(p => p.name).join('、') || '無'}`);
      if (allPlayers.some(p => p.role === 'MORDRED')) {
        visions.push('⚠️ 注意：有一位莫德雷德隱藏在陰影中，你無法看見他！');
      }
      break;
    }
    case 'PERCIVAL': {
      // 派西維爾看見梅林與莫甘娜（但不知道誰是誰）
      const merlinsAndMorganas = allPlayers.filter(p =>
        p.role === 'MERLIN' || p.role === 'MORGANA'
      );
      visions.push(`你的天眼顯現兩道先知光芒：${merlinsAndMorganas.map(p => p.name).join(' 與 ')}（其中一人為真梅林，另一人為邪惡莫甘娜）`);
      break;
    }
    case 'ASSASSIN':
    case 'MORGANA':
    case 'MORDRED':
    case 'MINION': {
      // 邪惡同夥互認（排除奧伯倫）
      const evilPartners = allPlayers.filter(p =>
        p.alignment === 'EVIL' && p.id !== player.id && p.role !== 'OBERON'
      );
      if (evilPartners.length > 0) {
        visions.push(`你的邪惡同夥為：${evilPartners.map(p => `${p.name} (${ROLE_INFO[p.role].name})`).join('、')}`);
      } else {
        visions.push('你是本局唯一的現身邪惡爪牙');
      }
      break;
    }
    case 'OBERON': {
      visions.push('你是隱世的奧伯倫，無人知曉你的真實身份，你亦無法看見其他邪惡同夥。');
      break;
    }
    case 'SERVANT': {
      visions.push('你是忠誠的光明侍衛，請透過圓桌討論、表情與出征表決找出同盟！');
      break;
    }
  }

  return visions;
}
