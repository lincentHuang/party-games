import { WordPair, Difficulty } from '@/types/game';
import { DEFAULT_WORD_PAIRS } from './wordsData';

const STORAGE_KEY_CUSTOM_WORDS = 'SPY_GAME_CUSTOM_WORDS_V1';
const STORAGE_KEY_USED_HISTORY = 'SPY_GAME_RECENT_WORDS_V1';
const MAX_HISTORY_LEN = 30;

export class WordManager {
  private customWords: WordPair[] = [];
  private usedHistory: string[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.customWords = this.loadCustomWords();
      this.usedHistory = this.loadHistory();
    }
  }

  loadCustomWords(): WordPair[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CUSTOM_WORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveCustomWords(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_WORDS, JSON.stringify(this.customWords));
    } catch (e) {
      console.error('Failed to save custom words', e);
    }
  }

  loadHistory(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = sessionStorage.getItem(STORAGE_KEY_USED_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  recordUsed(pair: WordPair): void {
    const key = `${pair.civilian}|${pair.spy}`;
    this.usedHistory.push(key);
    if (this.usedHistory.length > MAX_HISTORY_LEN) {
      this.usedHistory.shift();
    }
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_KEY_USED_HISTORY, JSON.stringify(this.usedHistory));
      } catch {}
    }
  }

  getAllWords(): WordPair[] {
    return [...DEFAULT_WORD_PAIRS, ...this.customWords];
  }

  getCustomWords(): WordPair[] {
    return this.customWords;
  }

  getCategories(): string[] {
    const all = this.getAllWords();
    const set = new Set(all.map(w => w.category || '未分類'));
    return Array.from(set);
  }

  getRandomWordPair(options: {
    difficulties?: Difficulty[];
    categories?: string[];
    includeCustom?: boolean;
  } = {}): WordPair {
    const {
      difficulties = ['easy', 'medium', 'hard'],
      categories = ['all'],
      includeCustom = true
    } = options;

    let pool = includeCustom ? this.getAllWords() : [...DEFAULT_WORD_PAIRS];

    if (difficulties && difficulties.length > 0) {
      pool = pool.filter(item => difficulties.includes(item.difficulty || 'medium'));
    }

    if (categories && !categories.includes('all') && categories.length > 0) {
      pool = pool.filter(item => categories.includes(item.category));
    }

    if (pool.length === 0) {
      pool = [...DEFAULT_WORD_PAIRS];
    }

    const freshPool = pool.filter(item => !this.usedHistory.includes(`${item.civilian}|${item.spy}`));
    const finalPool = freshPool.length > 0 ? freshPool : pool;

    const randomIndex = Math.floor(Math.random() * finalPool.length);
    const chosen = finalPool[randomIndex];

    const shouldSwap = Math.random() < 0.5;
    const result: WordPair = {
      civilian: shouldSwap ? chosen.spy : chosen.civilian,
      spy: shouldSwap ? chosen.civilian : chosen.spy,
      difficulty: chosen.difficulty || 'medium',
      category: chosen.category || '自訂分類',
      isCustom: !!chosen.id
    };

    this.recordUsed(chosen);
    return result;
  }

  addCustomWord(civilian: string, spy: string, difficulty: Difficulty = 'medium', category: string = '自訂題目'): WordPair {
    if (!civilian || !spy) {
      throw new Error('平民詞與間諜詞不能為空！');
    }
    const cleanCivilian = civilian.trim();
    const cleanSpy = spy.trim();

    if (cleanCivilian === cleanSpy) {
      throw new Error('平民詞與間諜詞不能完全相同！');
    }

    const newPair: WordPair = {
      id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      civilian: cleanCivilian,
      spy: cleanSpy,
      difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
      category: category.trim() || '自訂題目',
      createdAt: new Date().toISOString(),
      isCustom: true
    };

    this.customWords.unshift(newPair);
    this.saveCustomWords();
    return newPair;
  }

  deleteCustomWord(id: string): void {
    this.customWords = this.customWords.filter(w => w.id !== id);
    this.saveCustomWords();
  }

  clearAllCustomWords(): void {
    this.customWords = [];
    this.saveCustomWords();
  }

  batchImportText(text: string): { successCount: number; errors: string[] } {
    if (!text || typeof text !== 'string') return { successCount: 0, errors: ['內容為空'] };

    const lines = text.split(/\r?\n/);
    const addedList: WordPair[] = [];
    const errors: string[] = [];

    const difficultyMap: Record<string, Difficulty> = {
      'easy': 'easy', '簡單': 'easy', '休閒': 'easy', '1': 'easy',
      'medium': 'medium', '中等': 'medium', '普通': 'medium', '標準': 'medium', '2': 'medium',
      'hard': 'hard', '困難': 'hard', '高難': 'hard', '燒腦': 'hard', '3': 'hard'
    };

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        return;
      }

      const parts = trimmed.split(/[,;\t|，、]+/).map(p => p.trim()).filter(Boolean);

      if (parts.length < 2) {
        errors.push(`第 ${lineNum} 行格式不符（至少需有平民詞與間諜詞）："${trimmed}"`);
        return;
      }

      const civilian = parts[0];
      const spy = parts[1];
      let difficulty: Difficulty = 'medium';
      let category = '批次匯入';

      if (parts.length >= 3) {
        const rawDiff = parts[2].toLowerCase();
        if (difficultyMap[rawDiff]) {
          difficulty = difficultyMap[rawDiff];
        } else {
          category = parts[2];
        }
      }

      if (parts.length >= 4) {
        category = parts[3];
      }

      if (civilian === spy) {
        errors.push(`第 ${lineNum} 行平民詞與間諜詞相同，已略過：${civilian}`);
        return;
      }

      const pair: WordPair = {
        id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) + '_' + index,
        civilian,
        spy,
        difficulty,
        category,
        createdAt: new Date().toISOString(),
        isCustom: true
      };

      addedList.push(pair);
    });

    if (addedList.length > 0) {
      this.customWords = [...addedList, ...this.customWords];
      this.saveCustomWords();
    }

    return {
      successCount: addedList.length,
      errors
    };
  }

  exportAsText(onlyCustom: boolean = true): string {
    const list = onlyCustom ? this.customWords : this.getAllWords();
    const diffText = { easy: '簡單', medium: '中等', hard: '困難' };
    return list.map(item => `${item.civilian},${item.spy},${diffText[item.difficulty] || '中等'},${item.category || '未分類'}`).join('\n');
  }

  exportAsJSON(onlyCustom: boolean = true): string {
    const list = onlyCustom ? this.customWords : this.getAllWords();
    return JSON.stringify(list, null, 2);
  }
}

export const wordManagerInstance = new WordManager();
