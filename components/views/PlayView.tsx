'use client';

import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '@/lib/soundManager';
import { Player, WordPair, SpeechLogs } from '@/types/game';
import { speechService } from '@/lib/speechRecognition';
import { aiAgentService } from '@/lib/aiAgent';

interface PlayViewProps {
  round: number;
  totalPlayers: number;
  speechTime: number;
  currentSpeaker?: Player;
  startingSpeaker?: Player;
  players: Player[];
  alivePlayers: Player[];
  wordPair: WordPair;
  enableTTS: boolean;
  speechLogs: SpeechLogs;
  onRecordSpeech: (round: number, playerId: number, text: string) => void;
  onOpenSpeechLog: () => void;
  onNextSpeaker: () => void;
  onStartVote: () => void;
}

export const PlayView: React.FC<PlayViewProps> = ({
  round,
  totalPlayers,
  speechTime,
  currentSpeaker,
  startingSpeaker,
  players,
  alivePlayers,
  wordPair,
  enableTTS,
  speechLogs,
  onRecordSpeech,
  onOpenSpeechLog,
  onNextSpeaker,
  onStartVote
}) => {
  const [remainingTime, setRemainingTime] = useState<number>(speechTime);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 語音辨識與發言速記狀態
  const [currentText, setCurrentText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAIGenerating, setIsAIGenerating] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string>('');

  // 當發言者切換時：載入已有的紀錄或初始化，並處理 AI 自動發言
  useEffect(() => {
    // 停止先前的語音辨識
    speechService.stop();
    setIsListening(false);
    setSpeechError('');

    if (!currentSpeaker) return;

    // 重設計時器
    if (speechTime > 0) {
      setRemainingTime(speechTime);
    }

    const recorded = speechLogs[round]?.[currentSpeaker.id] || '';
    setCurrentText(recorded);

    // 若當前特工為 AI，且本輪尚未有紀錄，則啟動 AI 智慧思考與生成
    if (currentSpeaker.isAI && !recorded) {
      setIsAIGenerating(true);
      const existingClues = Object.values(speechLogs[round] || {});

      const timer = setTimeout(() => {
        const generatedClue = aiAgentService.generateClue(
          currentSpeaker,
          wordPair,
          round,
          existingClues
        );
        setCurrentText(generatedClue);
        onRecordSpeech(round, currentSpeaker.id, generatedClue);
        setIsAIGenerating(false);

        if (enableTTS) {
          aiAgentService.speakText(generatedClue);
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [currentSpeaker?.id, round]);

  // 倒數計時邏輯
  useEffect(() => {
    if (speechTime <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          soundManager.playTimerEnd();
          return 0;
        }
        if (prev <= 6 && prev > 1) {
          soundManager.playHeartbeat();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentSpeaker?.id, speechTime]);

  const circumference = 2 * Math.PI * 22;
  const progressFraction = speechTime > 0 ? remainingTime / speechTime : 0;
  const strokeDashoffset = circumference * (1 - progressFraction);

  // 切換語音輸入
  const handleToggleListening = () => {
    if (isListening) {
      speechService.stop();
      setIsListening(false);
    } else {
      setSpeechError('');
      soundManager.playClick();
      const started = speechService.start(
        (result) => {
          setCurrentText(result.transcript);
          if (currentSpeaker) {
            onRecordSpeech(round, currentSpeaker.id, result.transcript);
          }
        },
        (listening, err) => {
          setIsListening(listening);
          if (err) setSpeechError(err);
        }
      );
      if (!started && !speechService.checkSupport()) {
        setSpeechError('瀏覽器不支援語音辨識，請直接在文字框打字。');
      }
    }
  };

  // 手動更新文字
  const handleTextChange = (text: string) => {
    setCurrentText(text);
    if (currentSpeaker) {
      onRecordSpeech(round, currentSpeaker.id, text);
    }
  };

  // 換下一位發言特工
  const handleNext = () => {
    soundManager.playClick();
    speechService.stop();
    setIsListening(false);

    if (currentSpeaker && currentText.trim()) {
      onRecordSpeech(round, currentSpeaker.id, currentText.trim());
    }
    onNextSpeaker();
  };

  // 發起投票放逐
  const handleVote = () => {
    soundManager.playClick();
    speechService.stop();
    setIsListening(false);

    if (currentSpeaker && currentText.trim()) {
      onRecordSpeech(round, currentSpeaker.id, currentText.trim());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onStartVote();
  };

  // 計算目前輪次已記錄的發言數量
  const totalRecordedThisRound = Object.keys(speechLogs[round] || {}).length;

  return (
    <div className="view-container view-enter">
      {/* 頂部局勢狀態與速記冊捷徑 */}
      <div className="flex-between mb-sm shrink-0" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="badge badge-classified" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
            第 {round} 輪情報交換
          </span>
          <button
            onClick={onOpenSpeechLog}
            className="btn btn-ghost"
            style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--accent-cyan-light)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: 'var(--radius-full)' }}
          >
            📜 速記備忘 ({totalRecordedThisRound})
          </button>
        </div>
        <span className="badge badge-cyan" style={{ fontSize: '0.78rem', padding: '3px 8px' }}>
          存活: {alivePlayers.length} / {totalPlayers}
        </span>
      </div>

      {/* 當前發言特工聚光燈卡片 */}
      <div className="card card-glass mb-sm shrink-0 text-center" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', padding: '12px 14px' }}>
        <div className="flex-between mb-xs">
          <div className="badge badge-cyan" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
            當前發言特工
          </div>
          {currentSpeaker?.isAI && (
            <span className="badge badge-role-blank" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
              🤖 電腦 AI 特工
            </span>
          )}
        </div>

        {/* 特工頭像、名稱與精簡計時器區塊 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', margin: '4px 0 10px', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '2rem', background: 'var(--bg-elevated)', width: '48px', height: '48px', borderRadius: 'var(--radius-inner)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--accent-cyan-light)', flexShrink: 0 }}>
              {currentSpeaker ? currentSpeaker.icon : '🕵️'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.3rem', color: '#ffffff', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                {currentSpeaker ? currentSpeaker.name : '未知特工'}
              </h2>
              <div className="text-code text-cyan" style={{ fontSize: '0.75rem' }}>
                {currentSpeaker ? currentSpeaker.code : ''}
              </div>
            </div>
          </div>

          {/* 精巧整合計時器 */}
          {speechTime > 0 && (
            <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
              <svg viewBox="0 0 54 54" style={{ width: '48px', height: '48px', transform: 'rotate(-90deg)' }}>
                <circle cx="27" cy="27" r="22" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="4" />
                <circle
                  cx="27"
                  cy="27"
                  r="22"
                  fill="none"
                  stroke={remainingTime <= 10 ? 'var(--accent-magenta)' : 'var(--accent-cyan)'}
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: remainingTime <= 10 ? 'var(--accent-magenta)' : '#ffffff', lineHeight: 1, fontFamily: 'var(--font-display)' }}>
                  {remainingTime}
                </span>
                <span style={{ fontSize: '0.55rem', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
                  {remainingTime === 0 ? '到' : 'S'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 語音辨識與特工發言即時速記區 */}
        <div style={{ background: 'rgba(8, 12, 22, 0.7)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-inner)', padding: '10px', textAlign: 'left' }}>
          <div className="flex-between mb-xs">
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-secondary)', fontWeight: 600 }}>
              📝 特工發言速記 (說出即自動保存)
            </span>
            {!currentSpeaker?.isAI && (
              <button
                onClick={handleToggleListening}
                className={`btn ${isListening ? 'btn-danger' : 'btn-ghost'}`}
                style={{
                  padding: '3px 10px',
                  fontSize: '0.72rem',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: isListening ? 'none' : '1px solid var(--accent-cyan)'
                }}
              >
                {isListening ? (
                  <>
                    <span className="recording-dot" /> 聆聽中 (點擊停止)
                  </>
                ) : (
                  <>🎙️ 語音辨識</>
                )}
              </button>
            )}
          </div>

          {/* AI 思考中動畫或文字框 */}
          {isAIGenerating ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--accent-cyan-light)', fontSize: '0.85rem' }}>
              <span className="animate-pulse">🤖 AI 特工正在分析局勢並生成情報線索...</span>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <textarea
                className="input-text"
                rows={2}
                placeholder={currentSpeaker?.isAI ? 'AI 正在準備發言...' : '💬 點「語音辨識」說話，或在此手動輸入線索...'}
                value={currentText}
                onChange={e => handleTextChange(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: '0.88rem',
                  resize: 'none',
                  padding: '8px 10px',
                  paddingRight: currentSpeaker?.isAI && currentText && enableTTS ? '68px' : '10px',
                  background: isListening ? 'rgba(6, 182, 212, 0.08)' : undefined,
                  borderColor: isListening ? 'var(--accent-cyan)' : undefined,
                  minHeight: '52px'
                }}
              />
              {currentSpeaker?.isAI && currentText && enableTTS && (
                <button
                  onClick={() => aiAgentService.speakText(currentText)}
                  className="btn btn-ghost"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    bottom: '6px',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    color: 'var(--accent-cyan-light)',
                    background: 'rgba(6, 182, 212, 0.2)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  title="重播語音"
                >
                  🔊 朗讀
                </button>
              )}
            </div>
          )}

          {speechError && (
            <div style={{ fontSize: '0.72rem', color: '#fb7185', marginTop: '4px' }}>
              ⚠️ {speechError}
            </div>
          )}
        </div>
      </div>

      {/* 發言控制主要按鈕組 */}
      <div className="flex-col gap-xs mb-sm shrink-0">
        <button onClick={handleNext} className="btn btn-primary btn-large btn-full">
          ⏩ 換下一位特工發言
        </button>
        <button onClick={handleVote} className="btn btn-danger btn-full" style={{ padding: '10px 16px', fontSize: '0.92rem' }}>
          🗳️ 全員發言完畢，發起投票放逐
        </button>
      </div>

      {/* 特工席位狀態名冊 */}
      <div className="card shrink-0" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-between mb-xs shrink-0">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--fg-secondary)' }}>
            特工席位狀態
          </span>
          <span className="text-code text-muted" style={{ fontSize: '0.72rem' }}>
            起手: {startingSpeaker?.name || ''}
          </span>
        </div>
        <div className="agents-grid" style={{ gap: '8px' }}>
          {players.map(p => {
            const hasSpoken = Boolean(speechLogs[round]?.[p.id]);
            return (
              <div
                key={p.id}
                className={`agent-card shrink-0 ${p.id === currentSpeaker?.id ? 'speaking pulse-speaking' : ''} ${!p.isAlive ? 'eliminated' : ''}`}
                style={{ padding: '8px 10px', minHeight: '48px' }}
              >
                <div className="agent-avatar" style={{ width: '32px', height: '32px', fontSize: '1.2rem' }}>{p.icon}</div>
                <div className="agent-info">
                  <div className="agent-code" style={{ fontSize: '0.68rem' }}>{p.code}</div>
                  <div className="agent-name" style={{ fontSize: '0.82rem' }}>{p.name}</div>
                </div>
                {!p.isAlive && <div className="stamp-overlay">淘汰</div>}
                {p.id === currentSpeaker?.id && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan-light)', fontWeight: 'bold' }}>發言中</span>
                )}
                {p.isAlive && p.id !== currentSpeaker?.id && hasSpoken && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)', fontWeight: 'bold' }}>✓ 已記</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>

  );
};
