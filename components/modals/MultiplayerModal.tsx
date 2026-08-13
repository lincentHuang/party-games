'use client';

import React from 'react';
import { soundManager } from '@/lib/soundManager';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({ isOpen, onClose }) => {
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
            📡 多人連線模組架構
          </div>
          <button onClick={handleClose} className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
            ✕
          </button>
        </div>
        <div className="modal-body flex-col gap-md" style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
          <div className="text-center" style={{ padding: '10px 0' }}>
            <span style={{ fontSize: '3rem' }}>📡</span>
            <h3 style={{ color: '#ffffff', marginTop: '8px', fontSize: '1.3rem' }}>
              多手機房間連線規劃
            </h3>
            <p style={{ color: 'var(--accent-cyan-light)', fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>
              支援每位玩家使用各自手機掃碼進入同一房間同步遊玩。
            </p>
          </div>

          <div className="card" style={{ padding: '14px' }}>
            <div className="badge badge-cyan mb-sm">模組架構特色</div>
            <ul style={{ paddingLeft: '20px', color: 'var(--fg-secondary)', fontSize: '0.85rem' }}>
              <li><strong>房主開房</strong>：即時生成 4 碼房號與 QR Code。</li>
              <li><strong>各自看詞</strong>：手機獨立顯示專屬詞彙，私密性 100%。</li>
              <li><strong>同步投票</strong>：倒數結束所有人手機同時結算票數。</li>
            </ul>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', textAlign: 'center' }}>
            💡 提示：目前已優先為您把「單機傳閱模式」打造成最流暢、最無門檻的聚會首選體驗！
          </p>

          <button onClick={handleClose} className="btn btn-primary btn-large btn-full">
            了解，先體驗單機極致版
          </button>
        </div>
      </div>
    </div>
  );
};
