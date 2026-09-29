// lib/wondersData.ts
import { WonderBoard, WonderCard, WonderPlayer, ScoreSummary, ResourceType } from '@/types/wonders';

export const WONDER_BOARDS: WonderBoard[] = [
  {
    id: 'rhodes',
    name: '羅德島巨像 (Colossus of Rhodes)',
    baseResource: 'ORE',
    desc: '尚武之都，以無堅不摧的青銅巨像守護港灣，提供強大的軍事力量與勝利點。',
    icon: '🗿',
    stages: [
      { stage: 1, cost: { WOOD: 2 }, vp: 3, completed: false },
      { stage: 2, cost: { CLAY: 3 }, vp: 0, shields: 2, completed: false },
      { stage: 3, cost: { ORE: 4 }, vp: 7, completed: false }
    ]
  },
  {
    id: 'alexandria',
    name: '亞歷山大燈塔 (Lighthouse of Alexandria)',
    baseResource: 'GLASS',
    desc: '海上指路明燈，匯聚四方商賈，供應源源不絕的多元天然物產與豐盛寶庫。',
    icon: '🗼',
    stages: [
      { stage: 1, cost: { CLAY: 2 }, vp: 3, completed: false },
      { stage: 2, cost: { ORE: 2 }, vp: 0, coins: 4, completed: false },
      { stage: 3, cost: { GLASS: 2 }, vp: 7, completed: false }
    ]
  },
  {
    id: 'babylon',
    name: '巴比倫空中花園 (Hanging Gardens of Babylon)',
    baseResource: 'CLAY',
    desc: '古代文明奇蹟，繁花綠意中蘊藏深厚的天文與科學智慧。',
    icon: '🌴',
    stages: [
      { stage: 1, cost: { CLAY: 2 }, vp: 3, completed: false },
      { stage: 2, cost: { WOOD: 3 }, vp: 0, science: 'GEAR', completed: false },
      { stage: 3, cost: { CLAY: 4 }, vp: 7, completed: false }
    ]
  },
  {
    id: 'giza',
    name: '吉薩大金字塔 (Pyramids of Giza)',
    baseResource: 'STONE',
    desc: '跨越千年的宏偉陵寢，傾舉國之力修造，帶來無與倫比的崇高歷史分值。',
    icon: '🔺',
    stages: [
      { stage: 1, cost: { STONE: 2 }, vp: 3, completed: false },
      { stage: 2, cost: { WOOD: 3 }, vp: 5, completed: false },
      { stage: 3, cost: { STONE: 4 }, vp: 7, completed: false }
    ]
  }
];

// 第一時代卡牌 (Age I)
export const AGE_I_CARDS: WonderCard[] = [
  // 基礎資源
  { id: 'a1_wood', name: '伐木場', age: 1, category: 'RAW', cost: {}, provides: { resources: { WOOD: 1 } }, desc: '產出 1 木材' },
  { id: 'a1_stone', name: '採石場', age: 1, category: 'RAW', cost: {}, provides: { resources: { STONE: 1 } }, desc: '產出 1 石材' },
  { id: 'a1_clay', name: '黏土坑', age: 1, category: 'RAW', cost: {}, provides: { resources: { CLAY: 1 } }, desc: '產出 1 黏土' },
  { id: 'a1_ore', name: '礦脈', age: 1, category: 'RAW', cost: {}, provides: { resources: { ORE: 1 } }, desc: '產出 1 礦石' },
  { id: 'a1_glass', name: '玻璃工坊', age: 1, category: 'MANUFACTURED', cost: {}, provides: { resources: { GLASS: 1 } }, desc: '產出 1 玻璃' },
  { id: 'a1_papyrus', name: '造紙廠', age: 1, category: 'MANUFACTURED', cost: {}, provides: { resources: { PAPYRUS: 1 } }, desc: '產出 1 紙莎草' },
  // 市政建築 (藍)
  { id: 'a1_altar', name: '祭壇', age: 1, category: 'CIVIL', cost: {}, provides: { vp: 2 }, desc: '+2 勝利點' },
  { id: 'a1_theater', name: '露天劇場', age: 1, category: 'CIVIL', cost: {}, provides: { vp: 2 }, desc: '+2 勝利點' },
  { id: 'a1_baths', name: '公共浴池', age: 1, category: 'CIVIL', cost: { resources: { STONE: 1 } }, provides: { vp: 3 }, desc: '+3 勝利點' },
  // 軍事 (紅)
  { id: 'a1_barracks', name: '兵營', age: 1, category: 'MILITARY', cost: { resources: { ORE: 1 } }, provides: { shields: 1 }, desc: '+1 盾牌軍力' },
  { id: 'a1_stockade', name: '防禦柵欄', age: 1, category: 'MILITARY', cost: { resources: { WOOD: 1 } }, provides: { shields: 1 }, desc: '+1 盾牌軍力' },
  { id: 'a1_guard', name: '警衛塔', age: 1, category: 'MILITARY', cost: { resources: { CLAY: 1 } }, provides: { shields: 1 }, desc: '+1 盾牌軍力' },
  // 科技 (綠)
  { id: 'a1_workshop', name: '工坊', age: 1, category: 'SCIENCE', cost: { resources: { GLASS: 1 } }, provides: { science: 'GEAR' }, desc: '科技：齒輪' },
  { id: 'a1_apothecary', name: '藥劑所', age: 1, category: 'SCIENCE', cost: { resources: { PAPYRUS: 1 } }, provides: { science: 'COMPASS' }, desc: '科技：羅盤' },
  { id: 'a1_scriptorium', name: '抄寫室', age: 1, category: 'SCIENCE', cost: {}, provides: { science: 'TABLET' }, desc: '科技：石碑' },
  // 商業 (黃)
  { id: 'a1_tavern', name: '酒館', age: 1, category: 'COMMERCIAL', cost: {}, provides: { coins: 5 }, desc: '立即獲得 5 金幣' },
  { id: 'a1_market', name: '市集', age: 1, category: 'COMMERCIAL', cost: {}, provides: { coins: 3 }, desc: '立即獲得 3 金幣' }
];

// 第二時代卡牌 (Age II)
export const AGE_II_CARDS: WonderCard[] = [
  // 進階資源
  { id: 'a2_sawmill', name: '鋸木廠', age: 2, category: 'RAW', cost: { coins: 1 }, provides: { resources: { WOOD: 2 } }, desc: '產出 2 木材' },
  { id: 'a2_quarry', name: '石場', age: 2, category: 'RAW', cost: { coins: 1 }, provides: { resources: { STONE: 2 } }, desc: '產出 2 石材' },
  { id: 'a2_brickyard', name: '磚窯廠', age: 2, category: 'RAW', cost: { coins: 1 }, provides: { resources: { CLAY: 2 } }, desc: '產出 2 黏土' },
  { id: 'a2_foundry', name: '煉鐵廠', age: 2, category: 'RAW', cost: { coins: 1 }, provides: { resources: { ORE: 2 } }, desc: '產出 2 礦石' },
  // 市政 (藍)
  { id: 'a2_aqueduct', name: '引水道', age: 2, category: 'CIVIL', cost: { resources: { STONE: 3 } }, provides: { vp: 5 }, desc: '+5 勝利點' },
  { id: 'a2_temple', name: '神廟', age: 2, category: 'CIVIL', cost: { resources: { WOOD: 1, CLAY: 1, GLASS: 1 } }, provides: { vp: 4 }, desc: '+4 勝利點' },
  { id: 'a2_courthouse', name: '法院', age: 2, category: 'CIVIL', cost: { resources: { CLAY: 2 } }, provides: { vp: 4 }, desc: '+4 勝利點' },
  // 軍事 (紅)
  { id: 'a2_stables', name: '馬廄', age: 2, category: 'MILITARY', cost: { resources: { CLAY: 1, WOOD: 1, ORE: 1 } }, provides: { shields: 2 }, desc: '+2 盾牌軍力' },
  { id: 'a2_archery', name: '靶場', age: 2, category: 'MILITARY', cost: { resources: { WOOD: 2, ORE: 1 } }, provides: { shields: 2 }, desc: '+2 盾牌軍力' },
  { id: 'a2_training', name: '訓練場', age: 2, category: 'MILITARY', cost: { resources: { ORE: 2, WOOD: 1 } }, provides: { shields: 2 }, desc: '+2 盾牌軍力' },
  // 科技 (綠)
  { id: 'a2_laboratory', name: '實驗室', age: 2, category: 'SCIENCE', cost: { resources: { CLAY: 2, PAPYRUS: 1 } }, provides: { science: 'GEAR' }, desc: '科技：齒輪' },
  { id: 'a2_dispensary', name: '醫務所', age: 2, category: 'SCIENCE', cost: { resources: { ORE: 2, GLASS: 1 } }, provides: { science: 'COMPASS' }, desc: '科技：羅盤' },
  { id: 'a2_school', name: '學堂', age: 2, category: 'SCIENCE', cost: { resources: { WOOD: 1, PAPYRUS: 1 } }, provides: { science: 'TABLET' }, desc: '科技：石碑' },
  // 商業 (黃)
  { id: 'a2_bazaar', name: '巴札市集', age: 2, category: 'COMMERCIAL', cost: {}, provides: { coins: 4, vp: 1 }, desc: '獲得 4 金幣與 1 分' },
  { id: 'a2_vineyard', name: '葡萄園', age: 2, category: 'COMMERCIAL', cost: {}, provides: { coins: 4, vp: 1 }, desc: '獲得 4 金幣與 1 分' }
];

// 第三時代卡牌 (Age III)
export const AGE_III_CARDS: WonderCard[] = [
  // 宏偉市政 (藍)
  { id: 'a3_pantheon', name: '萬神殿', age: 3, category: 'CIVIL', cost: { resources: { CLAY: 2, ORE: 1, GLASS: 1 } }, provides: { vp: 7 }, desc: '+7 勝利點' },
  { id: 'a3_gardens', name: '空中花園閣', age: 3, category: 'CIVIL', cost: { resources: { WOOD: 2, CLAY: 1 } }, provides: { vp: 5 }, desc: '+5 勝利點' },
  { id: 'a3_palace', name: '皇家宮殿', age: 3, category: 'CIVIL', cost: { resources: { STONE: 1, ORE: 1, WOOD: 1, CLAY: 1, GLASS: 1 } }, provides: { vp: 8 }, desc: '+8 勝利點' },
  { id: 'a3_townhall', name: '市政大廳', age: 3, category: 'CIVIL', cost: { resources: { STONE: 2, ORE: 1, GLASS: 1 } }, provides: { vp: 6 }, desc: '+6 勝利點' },
  // 強悍軍事 (紅)
  { id: 'a3_siege', name: '攻城工坊', age: 3, category: 'MILITARY', cost: { resources: { CLAY: 3, WOOD: 1 } }, provides: { shields: 3 }, desc: '+3 盾牌軍力' },
  { id: 'a3_fort', name: '重裝要塞', age: 3, category: 'MILITARY', cost: { resources: { ORE: 3, STONE: 1 } }, provides: { shields: 3 }, desc: '+3 盾牌軍力' },
  { id: 'a3_arsenal', name: '帝國兵工廠', age: 3, category: 'MILITARY', cost: { resources: { ORE: 1, WOOD: 2, CLAY: 1 } }, provides: { shields: 3 }, desc: '+3 盾牌軍力' },
  // 高深科技 (綠)
  { id: 'a3_academy', name: '哲學院', age: 3, category: 'SCIENCE', cost: { resources: { STONE: 3, GLASS: 1 } }, provides: { science: 'COMPASS' }, desc: '科技：羅盤' },
  { id: 'a3_study', name: '博學院', age: 3, category: 'SCIENCE', cost: { resources: { WOOD: 1, PAPYRUS: 1 } }, provides: { science: 'GEAR' }, desc: '科技：齒輪' },
  { id: 'a3_university', name: '皇家大學', age: 3, category: 'SCIENCE', cost: { resources: { WOOD: 2, PAPYRUS: 1 } }, provides: { science: 'TABLET' }, desc: '科技：石碑' },
  // 公會與商業 (紫/黃)
  { id: 'a3_workers_guild', name: '工匠公會', age: 3, category: 'GUILD', cost: { resources: { ORE: 2, CLAY: 1, STONE: 1 } }, provides: { vp: 5 }, desc: '+5 勝利點' },
  { id: 'a3_spies_guild', name: '密探公會', age: 3, category: 'GUILD', cost: { resources: { CLAY: 3, GLASS: 1 } }, provides: { vp: 5 }, desc: '+5 勝利點' },
  { id: 'a3_philosophers', name: '賢者公會', age: 3, category: 'GUILD', cost: { resources: { CLAY: 3, PAPYRUS: 1 } }, provides: { vp: 5 }, desc: '+5 勝利點' },
  { id: 'a3_chamber', name: '商務廳', age: 3, category: 'COMMERCIAL', cost: { resources: { CLAY: 2 } }, provides: { coins: 6, vp: 3 }, desc: '獲得 6 金幣與 3 分' }
];

// 洗牌並分發手牌給各玩家 (每人 6 張)
export function dealAgeCards(age: 1 | 2 | 3, playerCount: number): WonderCard[][] {
  let deck: WonderCard[] = [];
  if (age === 1) deck = [...AGE_I_CARDS];
  else if (age === 2) deck = [...AGE_II_CARDS];
  else deck = [...AGE_III_CARDS];

  // Fisher-Yates 洗牌
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const hands: WonderCard[][] = [];
  const cardsPerHand = 6;
  for (let p = 0; p < playerCount; p++) {
    // 循環取牌
    const hand: WonderCard[] = [];
    for (let c = 0; c < cardsPerHand; c++) {
      const card = deck[(p * cardsPerHand + c) % deck.length];
      hand.push({ ...card, id: `${card.id}_${p}_${c}` });
    }
    hands.push(hand);
  }
  return hands;
}

// 計算玩家當前擁有的資源清單
export function getPlayerResources(player: WonderPlayer): Record<ResourceType, number> {
  const res: Record<ResourceType, number> = {
    WOOD: 0,
    STONE: 0,
    ORE: 0,
    CLAY: 0,
    GLASS: 0,
    PAPYRUS: 0
  };

  // 奇蹟自帶基礎資源
  res[player.wonder.baseResource] = (res[player.wonder.baseResource] || 0) + 1;

  // 建築物產出的資源
  for (const card of player.builtCards) {
    if (card.provides.resources) {
      for (const [rKey, amt] of Object.entries(card.provides.resources)) {
        res[rKey as ResourceType] = (res[rKey as ResourceType] || 0) + (amt || 0);
      }
    }
  }

  return res;
}

// 檢驗是否能興建此卡牌 (足夠資源與金幣)
export function canAffordCard(player: WonderPlayer, card: WonderCard): boolean {
  if (card.cost.coins && player.coins < card.cost.coins) {
    return false;
  }
  if (!card.cost.resources) return true;

  const playerRes = getPlayerResources(player);
  for (const [rKey, reqAmt] of Object.entries(card.cost.resources)) {
    if ((playerRes[rKey as ResourceType] || 0) < (reqAmt || 0)) {
      return false;
    }
  }
  return true;
}

// 檢驗是否能興造奇蹟下一階段
export function canAffordWonderStage(player: WonderPlayer): boolean {
  const nextStage = player.wonder.stages.find(s => !s.completed);
  if (!nextStage) return false;

  const playerRes = getPlayerResources(player);
  for (const [rKey, reqAmt] of Object.entries(nextStage.cost)) {
    if ((playerRes[rKey as ResourceType] || 0) < (reqAmt || 0)) {
      return false;
    }
  }
  return true;
}

// 總計分計算器
export function calculateScores(players: WonderPlayer[]): ScoreSummary[] {
  return players.map(p => {
    // 1. 軍事得分 (戰功標記加總)
    const militaryScore = p.militaryTokens.reduce((sum, val) => sum + val, 0);

    // 2. 國庫得分 (每 3 金幣 1 分)
    const treasuryScore = Math.floor(p.coins / 3);

    // 3. 奇蹟階段得分
    const wonderScore = p.wonder.stages
      .filter(s => s.completed)
      .reduce((sum, s) => sum + s.vp, 0);

    // 4. 市政建築得分 (藍牌)
    const civilScore = p.builtCards
      .filter(c => c.category === 'CIVIL')
      .reduce((sum, c) => sum + (c.provides.vp || 0), 0);

    // 5. 科技得分 (齒輪、羅盤、石碑：每種平方 + 每套7分)
    let gears = 0;
    let compasses = 0;
    let tablets = 0;
    for (const c of p.builtCards) {
      if (c.provides.science === 'GEAR') gears++;
      if (c.provides.science === 'COMPASS') compasses++;
      if (c.provides.science === 'TABLET') tablets++;
    }
    // 奇蹟階段可能也提供科技
    for (const s of p.wonder.stages) {
      if (s.completed && s.science) {
        if (s.science === 'GEAR') gears++;
        if (s.science === 'COMPASS') compasses++;
        if (s.science === 'TABLET') tablets++;
      }
    }
    const sets = Math.min(gears, compasses, tablets);
    const scienceScore = (gears * gears) + (compasses * compasses) + (tablets * tablets) + (sets * 7);

    // 6. 商業與公會得分 (黃牌與紫牌)
    const commercialScore = p.builtCards
      .filter(c => c.category === 'COMMERCIAL' || c.category === 'GUILD')
      .reduce((sum, c) => sum + (c.provides.vp || 0), 0);

    const totalScore = militaryScore + treasuryScore + wonderScore + civilScore + scienceScore + commercialScore;

    return {
      playerId: p.id,
      playerName: p.name,
      militaryScore,
      treasuryScore,
      wonderScore,
      civilScore,
      scienceScore,
      commercialScore,
      totalScore
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}
