// components/wonders/DraftingHand.tsx
'use client';

import React, { useState } from 'react';
import { WonderCard, WonderPlayer } from '@/types/wonders';
import { canAffordCard, canAffordWonderStage } from '@/lib/wondersData';
import { soundManager } from '@/lib/soundManager';

interface DraftingHandProps {
  player: WonderPlayer;
  hand: WonderCard[];
  onDraftCard: (cardId: string, action: 'BUILD' | 'WONDER' | 'DISCARD') => void;
}

export const DraftingHand: React.FC<DraftingHandProps> = ({
  player,
  hand,
  onDraftCard
}) => {
  const [selectedCard, setSelectedCard] = useState<WonderCard | null>(null);

  const handleCardClick = (card: WonderCard) => {
    soundManager.playClick();
    setSelectedCard(card);
  };

  const getCategoryClass = (category: WonderCard['category']) => {
    switch (category) {
      case 'RAW': return 'card-raw';
      case 'MANUFACTURED': return 'card-manufactured';
      case 'CIVIL': return 'card-civil';
      case 'COMMERCIAL': return 'card-commercial';
      case 'MILITARY': return 'card-military';
      case 'SCIENCE': return 'card-science';
      case 'GUILD': return 'card-guild';
      default: return '';
    }
  };

  const nextWonderStage = player.wonder.stages.find(s => !s.completed);
  const canAffordCurrentCard = selectedCard ? canAffordCard(player, selectedCard) : false;
  const canAffordCurrentWonder = canAffordWonderStage(player);

  return (
    <div className="card" style={{ padding: '14px' }}>
      <div className="flex-between mb-sm">
        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#ffffff' }}>
          🎴 輪抽手牌（請秘密擇一建造，剩餘牌傳給鄰邦）
        </span>
        <span className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
          剩餘 {hand.length} 張
        </span>
      </div>

      {/* 手牌橫向滾動網格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {hand.map(card => {
          const isSelected = selectedCard?.id === card.id;
          const affordable = canAffordCard(player, card);

          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card)}
              className={`wonder-card-item ${getCategoryClass(card.category)}`}
              style={{
                outline: isSelected ? '3px solid var(--accent-cyan)' : 'none',
                opacity: affordable ? 1 : 0.75,
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                  {card.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                  {card.desc}
                </div>
              </div>

              {/* 費用與產出 */}
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                <span style={{ color: affordable ? '#a7f3d0' : '#fca5a5', fontWeight: 800 }}>
                  {card.cost.coins ? `${card.cost.coins} 金` : card.cost.resources ? Object.entries(card.cost.resources).map(([r, n]) => `${n}${r[0]}`).join(' ') : '免費'}
                </span>
                <span className="badge" style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '0.68rem', padding: '2px 6px' }}>
                  時代 {card.age}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 選中卡牌決策操作區 */}
      {selectedCard && (
        <div
          className="view-enter"
          style={{
            background: 'var(--bg-elevated)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--border-card)'
          }}
        >
          <div className="flex-between mb-sm">
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                已選定：【{selectedCard.name}】
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-secondary)', marginTop: '2px' }}>
                {selectedCard.desc}
              </div>
            </div>
            <button
              onClick={() => setSelectedCard(null)}
              className="btn-ghost"
              style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}
            >
              取消重選
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {/* 1. 建造建築 */}
            <button
              onClick={() => onDraftCard(selectedCard.id, 'BUILD')}
              disabled={!canAffordCurrentCard}
              className="btn"
              style={{
                padding: '10px 4px',
                borderRadius: '8px',
                background: canAffordCurrentCard ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.06)',
                color: canAffordCurrentCard ? '#080c16' : 'var(--fg-muted)',
                fontWeight: 800,
                fontSize: '0.8rem',
                textAlign: 'center',
                opacity: canAffordCurrentCard ? 1 : 0.4
              }}
            >
              🏛️ 興建建築
              <div style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                {canAffordCurrentCard ? '資源充足' : '缺少原料/金幣'}
              </div>
            </button>

            {/* 2. 興建奇蹟階段 */}
            <button
              onClick={() => onDraftCard(selectedCard.id, 'WONDER')}
              disabled={!nextWonderStage || !canAffordCurrentWonder}
              className="btn"
              style={{
                padding: '10px 4px',
                borderRadius: '8px',
                background: nextWonderStage && canAffordCurrentWonder ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.06)',
                color: nextWonderStage && canAffordCurrentWonder ? '#080c16' : 'var(--fg-muted)',
                fontWeight: 800,
                fontSize: '0.8rem',
                textAlign: 'center',
                opacity: nextWonderStage && canAffordCurrentWonder ? 1 : 0.4
              }}
            >
              🏗️ 築奇蹟階段
              <div style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                {nextWonderStage ? `第 ${nextWonderStage.stage} 階 (+${nextWonderStage.vp}分)` : '已達最高階'}
              </div>
            </button>

            {/* 3. 棄牌換金 */}
            <button
              onClick={() => onDraftCard(selectedCard.id, 'DISCARD')}
              className="btn"
              style={{
                padding: '10px 4px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid var(--accent-yellow)',
                color: 'var(--accent-yellow)',
                fontWeight: 800,
                fontSize: '0.8rem',
                textAlign: 'center'
              }}
            >
              💰 棄牌換金
              <div style={{ fontSize: '0.68rem', marginTop: '2px' }}>
                立即領 +3 金幣
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
