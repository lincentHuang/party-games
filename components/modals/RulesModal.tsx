'use client';

import React from 'react';
import { soundManager } from '@/lib/soundManager';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleClose = () => {
    soundManager.playClick();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="modal-header">
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: '#ffffff' }}>
            📖 特工行動守則指南
          </div>
          <button onClick={handleClose} className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
            ✕
          </button>
        </div>
        <div className="modal-body flex-col gap-md" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
          <div>
            <h4 className="text-cyan mb-sm" style={{ fontSize: '1rem' }}>🎯 遊戲背景與目標</h4>
            <p style={{ color: 'var(--fg-secondary)' }}>
              特工局中潛入了敵對間諜！大家拿到的詞彙極為相似，唯有透過輪流發言與推理，找出誰的詞彙與大家不同。
            </p>
          </div>

          <div>
            <h4 className="text-emerald mb-sm" style={{ fontSize: '1rem' }}>🛡️ 特工身分與陣營</h4>
            <ul style={{ paddingLeft: '20px', color: 'var(--fg-secondary)' }}>
              <li><strong className="text-emerald">平民特工</strong>：拿到大眾共通詞彙（如「可口可樂」），目標是抓出所有間諜。</li>
              <li><strong className="text-magenta">間諜臥底</strong>：拿到相似但不同的詞彙（如「百事可樂」），目標是隱藏自己並誘導平民互投。</li>
              <li><strong className="text-yellow">白板特工</strong>（選用）：完全沒有拿到詞，靠聽其他人描述猜出題目並偽裝到最後。</li>
            </ul>
          </div>

          <div>
            <h4 className="text-cyan mb-sm" style={{ fontSize: '1rem' }}>🔄 遊戲流程</h4>
            <ol style={{ paddingLeft: '20px', color: 'var(--fg-secondary)' }}>
              <li><strong>傳閱看詞</strong>：輪流拿手機長按指紋查看自己的秘密詞彙。</li>
              <li><strong>輪流發言</strong>：由系統隨機指定起手特工，每人依序用「一句話」描述自己的詞（不可說出詞中的字）。</li>
              <li><strong>投票放逐</strong>：發言結束後大家自由討論並投票，得票最高者淘汰出局。</li>
              <li><strong>勝負判定</strong>：間諜全被揪出則平民勝；間諜存活人數大於等於平民則間諜勝！</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
