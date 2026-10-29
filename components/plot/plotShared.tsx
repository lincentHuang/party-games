'use client';

import React, { useState } from 'react';
import { PlotActionKind, PlotRole } from '@/types/plotRoom';

export const ROLE_INFO: Record<PlotRole, { emoji: string; name: string; desc: string }> = {
  TAX: { emoji: '💰', name: '稅務官', desc: '行動：收稅 +3 金。能阻擋「外援」。' },
  ASSASSIN: { emoji: '🗡️', name: '刺客', desc: '行動：付 3 金，指定一人失去一張牌。' },
  THIEF: { emoji: '🦹', name: '盜賊', desc: '行動：從一人身上拿走最多 2 金。能阻擋「盜賊」行動。' },
  ENVOY: { emoji: '📜', name: '密使', desc: '行動：抽 2 張牌換牌。能阻擋「盜賊」行動。' },
  GUARD: { emoji: '🛡️', name: '護衛', desc: '沒有主動行動。能阻擋針對你的「刺客」。' }
};

export const ACTION_INFO: Record<PlotActionKind, {
  emoji: string;
  label: string;
  desc: string;
  cost: number;
  needsTarget: boolean;
  claim: PlotRole | null;
}> = {
  INCOME: { emoji: '🪙', label: '收入', desc: '+1 金，不能被阻擋或質疑', cost: 0, needsTarget: false, claim: null },
  AID: { emoji: '💵', label: '外援', desc: '+2 金，任何人可宣稱稅務官阻擋', cost: 0, needsTarget: false, claim: null },
  COUP: { emoji: '⚔️', label: '政變', desc: '付 7 金，指定一人失去一張牌，不能阻擋', cost: 7, needsTarget: true, claim: null },
  TAX: { emoji: '💰', label: '稅務官', desc: '宣稱稅務官，+3 金', cost: 0, needsTarget: false, claim: 'TAX' },
  ASSASSINATE: { emoji: '🗡️', label: '刺客', desc: '宣稱刺客，付 3 金刺殺（目標可用護衛擋）', cost: 3, needsTarget: true, claim: 'ASSASSIN' },
  THIEF: { emoji: '🦹', label: '盜賊', desc: '宣稱盜賊，偷最多 2 金（目標可用盜賊／密使擋）', cost: 0, needsTarget: true, claim: 'THIEF' },
  ENVOY: { emoji: '📜', label: '密使', desc: '宣稱密使，抽 2 張換牌', cost: 0, needsTarget: false, claim: 'ENVOY' }
};

export const TURN_ACTIONS: PlotActionKind[] = ['INCOME', 'AID', 'TAX', 'THIEF', 'ENVOY', 'ASSASSINATE', 'COUP'];

// 一張牌（暗牌背面／正面／已翻開）
export const CardFace: React.FC<{
  role: PlotRole;
  revealed?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
}> = ({ role, revealed, selected, onClick, disabled, small }) => {
  const info = ROLE_INFO[role];
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || disabled}
      className="card"
      style={{
        flex: 1,
        minWidth: small ? '64px' : '110px',
        padding: small ? '8px 6px' : '14px 8px',
        textAlign: 'center',
        cursor: clickable ? 'pointer' : 'default',
        opacity: revealed ? 0.45 : 1,
        borderColor: selected ? 'var(--accent-yellow)' : undefined,
        boxShadow: selected ? '0 0 16px var(--accent-yellow)' : undefined,
        filter: revealed ? 'grayscale(0.8)' : undefined
      }}
    >
      <div style={{ fontSize: small ? '1.4rem' : '2.2rem' }}>{info.emoji}</div>
      <div style={{ color: '#ffffff', fontWeight: 800, fontSize: small ? '0.8rem' : '1rem' }}>{info.name}</div>
      {revealed && <div style={{ fontSize: '0.72rem', color: 'var(--accent-magenta)', marginTop: '2px' }}>已翻開</div>}
    </button>
  );
};

// 已公開翻開的牌（小標籤）
export const RevealedChips: React.FC<{ roles: PlotRole[] }> = ({ roles }) => (
  <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
    {roles.map((r, i) => (
      <span key={i} style={{ fontSize: '0.74rem', padding: '1px 6px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.18)', color: 'var(--fg-secondary)', textDecoration: 'line-through' }}>
        {ROLE_INFO[r].emoji}{ROLE_INFO[r].name}
      </span>
    ))}
  </span>
);

// 角色速查表（可展開）
export const CheatSheet: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="card shrink-0 mb-md" style={{ padding: '10px 14px' }}>
      <button onClick={() => setOpen(o => !o)} className="flex-between" style={{ width: '100%', background: 'none', border: 'none', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}>
        <span>📖 角色速查表</span>
        <span style={{ color: 'var(--fg-muted)' }}>{open ? '收起 ▲' : '展開 ▼'}</span>
      </button>
      {open && (
        <div className="flex-col gap-sm" style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--fg-secondary)' }}>
          {(Object.keys(ROLE_INFO) as PlotRole[]).map(r => (
            <div key={r}><strong style={{ color: '#ffffff' }}>{ROLE_INFO[r].emoji} {ROLE_INFO[r].name}</strong>　{ROLE_INFO[r].desc}</div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
            🪙 收入 +1（不能擋）・💵 外援 +2（稅務官可擋）・⚔️ 政變 7 金（不能擋，10 金以上必須政變）
          </div>
          <div>每種角色 3 張。宣稱角色時其他人可以質疑：真有牌，質疑者失去一張；沒有，宣稱者失去一張。兩張都翻開就淘汰，最後存活者勝。</div>
        </div>
      )}
    </div>
  );
};
