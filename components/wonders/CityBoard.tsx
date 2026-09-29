// components/wonders/CityBoard.tsx
'use client';

import React from 'react';
import { WonderPlayer } from '@/types/wonders';
import { getPlayerResources } from '@/lib/wondersData';

interface CityBoardProps {
  player: WonderPlayer;
}

export const CityBoard: React.FC<CityBoardProps> = ({ player }) => {
  const resources = getPlayerResources(player);

  // 計算軍力盾牌總數
  let totalShields = player.builtCards
    .filter(c => c.category === 'MILITARY')
    .reduce((sum, c) => sum + (c.provides.shields || 0), 0);
  for (const s of player.wonder.stages) {
    if (s.completed && s.shields) totalShields += s.shields;
  }

  return (
    <div className="card" style={{ padding: '14px', background: 'var(--bg-card)' }}>
      {/* 奇蹟頂部橫幅 */}
      <div className="flex-between mb-sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.6rem' }}>{player.wonder.icon}</span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#ffffff' }}>
              {player.name} · {player.wonder.name.split(' (')[0]}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
              {player.wonder.desc.substring(0, 32)}...
            </div>
          </div>
        </div>

        {/* 國庫與軍力 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-yellow" style={{ fontSize: '0.82rem', padding: '4px 8px' }}>
            💰 {player.coins} 金
          </span>
          <span className="badge badge-classified" style={{ fontSize: '0.82rem', padding: '4px 8px' }}>
            🛡️ {totalShields} 盾
          </span>
        </div>
      </div>

      {/* 資源產出一覽 */}
      <div className="flex-between mb-sm" style={{ flexWrap: 'wrap', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '10px' }}>
        <div className="resource-pill" style={{ color: '#fed7aa' }}>🪵 木材: {resources.WOOD}</div>
        <div className="resource-pill" style={{ color: '#e2e8f0' }}>🪨 石材: {resources.STONE}</div>
        <div className="resource-pill" style={{ color: '#cbd5e1' }}>⛏️ 礦石: {resources.ORE}</div>
        <div className="resource-pill" style={{ color: '#fca5a5' }}>🧱 黏土: {resources.CLAY}</div>
        <div className="resource-pill" style={{ color: '#67e8f9' }}>🧪 玻璃: {resources.GLASS}</div>
        <div className="resource-pill" style={{ color: '#fef08a' }}>📜 紙草: {resources.PAPYRUS}</div>
      </div>

      {/* 奇蹟三大階段修建進度 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {player.wonder.stages.map(stage => {
          const isDone = stage.completed;
          return (
            <div
              key={stage.stage}
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: isDone ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-elevated)',
                border: `1px solid ${isDone ? 'var(--accent-yellow)' : 'var(--border-subtle)'}`,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: isDone ? 'var(--accent-yellow)' : 'var(--fg-muted)', fontWeight: 800 }}>
                {isDone ? '✨ 已完工' : `第 ${stage.stage} 階段`}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', margin: '2px 0' }}>
                {stage.vp ? `+${stage.vp} 分` : stage.shields ? `+${stage.shields} 盾` : '+獎勵'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)' }}>
                {Object.entries(stage.cost).map(([r, n]) => `${n}${r[0]}`).join(' ')}
              </div>
            </div>
          );
        })}
      </div>

      {/* 已興建的卡牌標籤流 */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--fg-muted)', marginBottom: '4px' }}>
          🏛️ 已建城邦建築 ({player.builtCards.length} 座)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {player.builtCards.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>尚無建築，輪抽挑選第一張牌開始興建</span>
          ) : (
            player.builtCards.map(c => (
              <span
                key={c.id}
                className="badge"
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  background:
                    c.category === 'RAW' ? '#78350f' :
                    c.category === 'MANUFACTURED' ? '#475569' :
                    c.category === 'CIVIL' ? '#1d4ed8' :
                    c.category === 'COMMERCIAL' ? '#d97706' :
                    c.category === 'MILITARY' ? '#dc2626' :
                    c.category === 'SCIENCE' ? '#059669' : '#7c3aed',
                  color: '#ffffff'
                }}
              >
                {c.name}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
