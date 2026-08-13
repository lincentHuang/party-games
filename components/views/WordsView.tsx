'use client';

import React, { useState, useMemo } from 'react';
import { soundManager } from '@/lib/soundManager';
import { wordManagerInstance } from '@/lib/wordManager';
import { Difficulty } from '@/types/game';

interface WordsViewProps {
  onBack: () => void;
}

export const WordsView: React.FC<WordsViewProps> = ({ onBack }) => {
  const [currentTab, setCurrentTab] = useState<'browse' | 'add' | 'batch'>('browse');
  const [filterDiff, setFilterDiff] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // 單筆新增表單狀態
  const [addCiv, setAddCiv] = useState('');
  const [addSpy, setAddSpy] = useState('');
  const [addDiff, setAddDiff] = useState<Difficulty>('medium');
  const [addCat, setAddCat] = useState('自訂題目');
  const [addError, setAddError] = useState('');

  // 批次匯入狀態
  const [batchText, setBatchText] = useState('');
  const [batchFeedback, setBatchFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  const allWords = useMemo(() => {
    return wordManagerInstance.getAllWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const customWords = useMemo(() => {
    return wordManagerInstance.getCustomWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filteredWords = useMemo(() => {
    let list = allWords;
    if (filterDiff !== 'all') {
      list = list.filter(w => (w.difficulty || 'medium') === filterDiff);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(w =>
        w.civilian.toLowerCase().includes(q) ||
        w.spy.toLowerCase().includes(q) ||
        (w.category && w.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allWords, filterDiff, searchQuery]);

  const handleDeleteCustom = (id?: string) => {
    if (!id) return;
    soundManager.playClick();
    wordManagerInstance.deleteCustomWord(id);
    setRefreshKey(prev => prev + 1);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      wordManagerInstance.addCustomWord(addCiv, addSpy, addDiff, addCat);
      soundManager.playRevealSecret();
      alert(`成功新增自訂題目：${addCiv} vs ${addSpy}`);
      setAddCiv('');
      setAddSpy('');
      setAddError('');
      setRefreshKey(prev => prev + 1);
      setCurrentTab('browse');
    } catch (err: unknown) {
      soundManager.playClick();
      if (err instanceof Error) {
        setAddError(err.message);
      } else {
        setAddError('新增失敗，請檢查輸入內容');
      }
    }
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = wordManagerInstance.batchImportText(batchText);
    if (res.successCount > 0) {
      soundManager.playRevealSecret();
      setBatchFeedback({
        success: true,
        msg: `✅ 成功匯入 ${res.successCount} 組題目！`
      });
      setBatchText('');
      setRefreshKey(prev => prev + 1);
    } else {
      soundManager.playClick();
      setBatchFeedback({
        success: false,
        msg: `❌ 匯入失敗：${res.errors.join('、')}`
      });
    }
  };

  const handleExportText = () => {
    const text = wordManagerInstance.exportAsText(false);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        soundManager.playClick();
        alert('已將全體題庫複製到剪貼簿！');
      }).catch(() => {
        alert('複製失敗，請手動複製。');
      });
    }
  };

  const handleClearCustom = () => {
    if (confirm('確定要清空所有自訂題目嗎？內建題目不會受到影響。')) {
      soundManager.playClick();
      wordManagerInstance.clearAllCustomWords();
      setRefreshKey(prev => prev + 1);
    }
  };

  return (
    <div className="view-container view-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 頂部標題列 */}
      <div className="flex-between mb-sm shrink-0">
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
          ← 返回首頁
        </button>
        <span className="badge badge-cyan">🗃️ 絕密題庫庫房</span>
      </div>

      {/* 題庫總覽統計卡片 */}
      <div className="card mb-md shrink-0" style={{ padding: '14px 16px' }}>
        <div className="flex-between">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
              收錄題目: {allWords.length} 組
            </div>
            <div className="text-code text-cyan" style={{ fontSize: '0.8rem' }}>
              內建: {allWords.length - customWords.length} 組 ｜ 自訂: {customWords.length} 組
            </div>
          </div>
          <span className="badge badge-easy">可自由擴充</span>
        </div>
      </div>

      {/* 功能分頁切換 Tabs */}
      <div className="filter-group mb-md shrink-0">
        <button
          onClick={() => { soundManager.playClick(); setCurrentTab('browse'); }}
          className={`chip-btn ${currentTab === 'browse' ? 'active' : ''}`}
        >
          📚 題庫瀏覽
        </button>
        <button
          onClick={() => { soundManager.playClick(); setCurrentTab('add'); }}
          className={`chip-btn ${currentTab === 'add' ? 'active' : ''}`}
        >
          ➕ 單筆新增
        </button>
        <button
          onClick={() => { soundManager.playClick(); setCurrentTab('batch'); }}
          className={`chip-btn ${currentTab === 'batch' ? 'active' : ''}`}
        >
          ⚡ 批次匯入/匯出
        </button>
      </div>

      {/* 分頁 1: 題庫瀏覽 */}
      {currentTab === 'browse' && (
        <div className="flex-col gap-sm flex-1 min-h-0" style={{ display: 'flex' }}>
          {/* 搜尋列 */}
          <div className="shrink-0">
            <input
              type="text"
              className="input-text"
              placeholder="🔍 搜尋詞彙或分類..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '10px 14px', fontSize: '0.9rem' }}
            />
          </div>

          {/* 難度篩選 Chip */}
          <div className="filter-group mb-sm shrink-0">
            <button onClick={() => setFilterDiff('all')} className={`chip-btn ${filterDiff === 'all' ? 'active' : ''}`}>全部</button>
            <button onClick={() => setFilterDiff('easy')} className={`chip-btn chip-easy ${filterDiff === 'easy' ? 'active' : ''}`}>🟢 簡單</button>
            <button onClick={() => setFilterDiff('medium')} className={`chip-btn chip-medium ${filterDiff === 'medium' ? 'active' : ''}`}>🟡 中等</button>
            <button onClick={() => setFilterDiff('hard')} className={`chip-btn chip-hard ${filterDiff === 'hard' ? 'active' : ''}`}>🔴 困難</button>
          </div>

          {/* 題目滾動清單 */}
          <div className="flex-col gap-sm flex-1 min-h-0 overflow-y-auto" style={{ paddingRight: '2px' }}>
            {filteredWords.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: '40px 0' }}>無符合條件之題目</div>
            ) : (
              filteredWords.map((item, idx) => {
                const diffMap: Record<string, string> = { easy: '簡單', medium: '中等', hard: '困難' };
                const diffBadgeClass = item.difficulty === 'easy' ? 'badge-easy' : (item.difficulty === 'hard' ? 'badge-hard' : 'badge-medium');

                return (
                  <div key={item.id || idx} className="card shrink-0" style={{ padding: '12px 14px' }}>
                    <div className="flex-between">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', fontSize: '1rem' }}>{item.civilian}</span>
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>vs</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-magenta)', fontSize: '1rem' }}>{item.spy}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`badge ${diffBadgeClass}`} style={{ fontSize: '0.72rem' }}>{diffMap[item.difficulty || 'medium']}</span>
                        {item.id && (
                          <button onClick={() => handleDeleteCustom(item.id)} className="btn-icon" style={{ width: '26px', height: '26px', fontSize: '0.8rem', color: 'var(--accent-magenta)' }} title="刪除">✕</button>
                        )}
                      </div>
                    </div>
                    <div className="flex-between mt-sm" style={{ marginTop: '6px' }}>
                      <span className="text-code text-muted" style={{ fontSize: '0.72rem' }}>{item.category || '未分類'}</span>
                      {item.id ? <span className="badge badge-classified" style={{ fontSize: '0.65rem' }}>自訂</span> : <span className="text-muted" style={{ fontSize: '0.65rem' }}>內建</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 分頁 2: 單筆新增 */}
      {currentTab === 'add' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <form onSubmit={handleAddSubmit} className="card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '14px' }}>➕ 新增自訂詞對</h3>
            <div className="flex-col gap-md">
              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', display: 'block', marginBottom: '4px' }}>平民詞彙 (Civilian Word)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="例如：可口可樂"
                  value={addCiv}
                  onChange={(e) => setAddCiv(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--accent-magenta)', display: 'block', marginBottom: '4px' }}>間諜詞彙 (Spy Word)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="例如：百事可樂"
                  value={addSpy}
                  onChange={(e) => setAddSpy(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', display: 'block', marginBottom: '4px' }}>題目難度 (Difficulty)</label>
                <select
                  className="input-text"
                  value={addDiff}
                  onChange={(e) => setAddDiff(e.target.value as Difficulty)}
                  style={{ padding: '10px' }}
                >
                  <option value="easy">🟢 休閒特訓 (簡單 - 特徵鮮明)</option>
                  <option value="medium">🟡 標準行動 (中等 - 細微差異)</option>
                  <option value="hard">🔴 絕密諜影 (困難 - 高度相似燒腦)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--fg-secondary)', display: 'block', marginBottom: '4px' }}>題目分類 (Category)</label>
                <input
                  type="text"
                  className="input-text"
                  placeholder="例如：生活、朋友梗、美食"
                  value={addCat}
                  onChange={(e) => setAddCat(e.target.value)}
                />
              </div>

              {addError && (
                <div className="text-magenta" style={{ fontSize: '0.82rem' }}>{addError}</div>
              )}

              <button type="submit" className="btn btn-primary btn-large btn-full mt-sm">
                💾 儲存並加入題庫
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 分頁 3: 批次匯入/匯出 */}
      {currentTab === 'batch' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <form onSubmit={handleBatchSubmit} className="card" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '8px' }}>⚡ 快速批次文字匯入</h3>
            <p style={{ color: 'var(--fg-secondary)', fontSize: '0.82rem', lineHeight: 1.45, marginBottom: '12px' }}>
              每行貼上一組題目，格式為：<br />
              <code className="text-code text-cyan">平民詞,間諜詞,難度(簡單/中等/困難),分類</code><br />
              或最簡單只需：<code className="text-code text-cyan">平民詞,間諜詞</code>
            </p>

            <textarea
              className="textarea-batch mb-sm"
              placeholder={`珍奶,布丁奶茶,簡單,飲品\n炸雞,鹹酥雞,中等,美食\n烏龍茶,鐵觀音,困難,飲品`}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              required
            />

            {batchFeedback && (
              <div style={{ fontSize: '0.82rem', marginBottom: '10px', color: batchFeedback.success ? 'var(--accent-emerald)' : 'var(--accent-magenta)' }}>
                {batchFeedback.msg}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full mb-md">
              📥 一鍵匯入至自訂題庫
            </button>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', color: '#ffffff', marginBottom: '8px' }}>📤 題庫分享與備份</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button type="button" onClick={handleExportText} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '10px 12px' }}>
                  複製純文字題庫
                </button>
                <button type="button" onClick={handleClearCustom} className="btn btn-ghost" style={{ fontSize: '0.82rem', padding: '10px 12px', color: 'var(--accent-magenta)', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
                  清空自訂題庫
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
