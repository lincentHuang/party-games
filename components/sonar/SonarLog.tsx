// components/sonar/SonarLog.tsx
'use client';

import React from 'react';
import { SonarEventLog } from '@/types/sonar';

interface SonarLogProps {
  logs: SonarEventLog[];
}

export const SonarLog: React.FC<SonarLogProps> = ({ logs }) => {
  return (
    <div className="card" style={{ padding: '12px', maxHeight: '140px', overflowY: 'auto' }}>
      <div className="flex-between mb-xs">
        <span style={{ fontSize: '0.8rem', fontWeight: 850, color: 'var(--accent-cyan-light)' }}>
          📻 聲納通信與交火情報日誌
        </span>
        <span className="dot-status" />
      </div>
      <div className="flex-col gap-xs" style={{ fontSize: '0.78rem' }}>
        {logs.map(log => {
          let badgeColor = 'rgba(255,255,255,0.1)';
          let textColor = 'var(--fg-secondary)';
          if (log.type === 'HIT') {
            badgeColor = 'rgba(244, 63, 94, 0.3)';
            textColor = '#fca5a5';
          } else if (log.type === 'SONAR') {
            badgeColor = 'rgba(6, 182, 212, 0.3)';
            textColor = '#67e8f9';
          } else if (log.type === 'SURFACE') {
            badgeColor = 'rgba(245, 158, 11, 0.3)';
            textColor = '#fde68a';
          }

          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'baseline',
                background: badgeColor,
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.7rem', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                [{log.time}]
              </span>
              <span style={{ color: textColor, lineHeight: 1.35 }}>
                {log.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
