/**
 * AI 特工智慧大腦 (AI Agent Brain)
 * 包含：
 * 1. 智慧描述詞生成演算法 (精準匹配 120+ 預設詞彙、無重複防撞機制、分輪次語意深化)
 * 2. 語音朗讀 (SpeechSynthesis TTS)
 * 3. AI 投票博弈推論
 */

import { Player, Role, WordPair } from '@/types/game';
import { WORD_CLUES_DATABASE, GENERIC_CATEGORY_CLUES, BLANK_STAGE_CLUES } from '@/lib/aiCluesData';

// 多元自然口語句型模板
const NATURAL_TEMPLATES = [
  (trait: string) => `我覺得${trait}。`,
  (trait: string) => `這個東西${trait}。`,
  (trait: string) => `我對它的印象是${trait}。`,
  (trait: string) => `基本上${trait}，大家應該都懂。`,
  (trait: string) => `簡單來說，${trait}。`,
  (trait: string) => `以我的理解，${trait}。`,
  (trait: string) => `它給我的感覺是${trait}。`,
  (trait: string) => `在我的認知裡，${trait}。`
];

export class AIAgentService {
  /**
   * 智慧生成 AI 特工描述詞（防重複、分輪次、具備豐富情境）
   */
  public generateClue(
    aiPlayer: Player,
    wordPair: WordPair,
    round: number,
    existingClues: string[] = []
  ): string {
    const role = aiPlayer.role;
    const word = aiPlayer.word?.trim() || '';

    // 1. 白板特工：按輪次挑選未曾使用過的掩護台詞
    if (role === 'BLANK' || !word || word.includes('白板')) {
      const stageIndex = Math.min(Math.max(0, round - 1), BLANK_STAGE_CLUES.length - 1);
      const stagePool = BLANK_STAGE_CLUES[stageIndex] || BLANK_STAGE_CLUES[0];

      // 過濾掉已經在局中說過的台詞
      const availableBlankClues = stagePool.filter(
        c => !existingClues.some(ec => ec.includes(c) || c.includes(ec))
      );

      const chosen =
        availableBlankClues.length > 0
          ? availableBlankClues[Math.floor(Math.random() * availableBlankClues.length)]
          : stagePool[Math.floor(Math.random() * stagePool.length)];

      return chosen;
    }

    // 2. 平民與間諜特工：從完整預設題庫中檢索
    const traits = WORD_CLUES_DATABASE[word];

    if (traits && traits.length > 0) {
      // 找出尚未在場上被說過（未出現在 existingClues）的特徵
      const unusedTraits = traits.filter(
        t => !existingClues.some(ec => ec.includes(t) || t.includes(ec))
      );

      let selectedTrait: string;
      if (unusedTraits.length > 0) {
        // 依據輪次給予傾向：第一輪優先講前面的基礎特徵，後續輪次講進階特徵
        const preferredIndex = Math.min(round - 1, unusedTraits.length - 1);
        // 在候選中隨機挑選或依照輪次順序
        selectedTrait = unusedTraits[preferredIndex] || unusedTraits[0];
      } else {
        // 若特徵都用過一輪，依據 (round - 1) % traits.length 輪替
        const cycleIndex = (round - 1) % traits.length;
        selectedTrait = traits[cycleIndex];
      }

      // 隨機挑選一個不重複感強烈的口語句型包裝
      const template = NATURAL_TEMPLATES[Math.floor(Math.random() * NATURAL_TEMPLATES.length)];
      return template(selectedTrait);
    }

    // 3. 自訂題庫或未在預設表中的詞彙：利用分類多輪特徵庫動態合成
    const categoryGroup = GENERIC_CATEGORY_CLUES[wordPair.category] || GENERIC_CATEGORY_CLUES['生活用品'];
    const categoryRoundIndex = Math.min(Math.max(0, round - 1), categoryGroup.length - 1);
    const categoryCandidates = categoryGroup[categoryRoundIndex] || categoryGroup[0];

    const unusedCatClues = categoryCandidates.filter(
      c => !existingClues.some(ec => ec.includes(c) || c.includes(ec))
    );

    const chosenCatTrait =
      unusedCatClues.length > 0
        ? unusedCatClues[Math.floor(Math.random() * unusedCatClues.length)]
        : categoryCandidates[0];

    const template = NATURAL_TEMPLATES[Math.floor(Math.random() * NATURAL_TEMPLATES.length)];
    return template(chosenCatTrait);
  }

  /**
   * 透過瀏覽器 SpeechSynthesis 念出 AI 的發言
   */
  public speakText(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel(); // 停止先前的朗讀
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // 嘗試挑選繁中語音
        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh-HK' || v.lang.startsWith('zh'));
        if (zhVoice) {
          utterance.voice = zhVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        resolve();
      }
    });
  }

  /**
   * AI 投票決策推論：返回 AI 想要放逐的玩家 ID
   */
  public makeVoteDecision(aiPlayer: Player, alivePlayers: Player[]): number {
    const candidates = alivePlayers.filter(p => p.id !== aiPlayer.id);
    if (candidates.length === 0) return aiPlayer.id;

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex].id;
  }
}

export const aiAgentService = new AIAgentService();
