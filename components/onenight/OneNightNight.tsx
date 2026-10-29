'use client';

import React, { useState } from 'react';
import { NONE, OneNightAction, OneNightRole, OneNightRoomView } from '@/types/oneNightRoom';
import { CenterPicker, IntelList, PickList } from './onenightShared';

interface OneNightNightProps {
  view: OneNightRoomView;
  isBusy: boolean;
  // 夜晚的操作不播任何音效／震動，避免旁人看出誰有行動
  onAct: (action: OneNightAction) => Promise<boolean>;
  header: React.ReactNode;
  hostBar: React.ReactNode;
  footer: React.ReactNode;
}

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ color: 'var(--fg-secondary)', fontSize: '0.88rem', margin: '4px 0 0' }}>{children}</p>
);

const Instruction: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="card shrink-0 mb-md" style={{ padding: '12px 14px' }}>
    <strong style={{ color: '#ffffff' }}>{title}</strong>
    {children && <Hint>{children}</Hint>}
  </div>
);

export const OneNightNight: React.FC<OneNightNightProps> = ({ view, isBusy, onAct, header, hostBar, footer }) => {
  const night = view.night!;
  const me = view.me.id;
  const nameOf = (id: string | null | undefined) => view.seats.find(s => s.playerId === id)?.name || '—';
  const others = view.seats.filter(s => s.playerId !== me);
  const [picked, setPicked] = useState<string[]>([]);
  const [centerPicked, setCenterPicked] = useState<number[]>([]);
  const [seerMode, setSeerMode] = useState<'PLAYER' | 'CENTER'>('PLAYER');
  const act = (a: OneNightAction) => { onAct(a); };

  // 已偷看／預言家看到的中央牌
  const revealed: Record<number, OneNightRole> = {};
  for (const it of view.intel) {
    if (it.kind === 'PEEK_CENTER') it.indices.forEach((idx, i) => { revealed[idx] = it.roles[i]; });
  }

  const togglePlayer = (id: string, max: number) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= max ? [...prev.slice(1), id] : [...prev, id]));
  const toggleCenter = (i: number, max: number) =>
    setCenterPicked(prev => (prev.includes(i) ? prev.filter(x => x !== i) : prev.length >= max ? [...prev.slice(1), i] : [...prev, i]));

  const confirmBtn = (label: string, onClick: () => void, enabled: boolean) => (
    <button onClick={onClick} disabled={!enabled || isBusy} className="btn btn-primary btn-large btn-full shrink-0 mb-md">
      {label}
    </button>
  );
  const skipBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} disabled={isBusy} className="btn btn-secondary btn-full shrink-0 mb-md">{label}</button>
  );

  const title = (
    <div className="text-center shrink-0 mb-md">
      <div style={{ fontSize: '2.2rem' }}>🌙</div>
      <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 900 }}>天黑請閉眼</h2>
      <div className="text-code" style={{ marginTop: '6px', color: 'var(--accent-cyan-light)', fontWeight: 800 }}>
        已完成 {night.progress.done} / {night.progress.total}
      </div>
    </div>
  );

  let body: React.ReactNode = null;

  if (night.myDone) {
    body = (
      <>
        <div className="card shrink-0 mb-md" style={{ padding: '14px' }}>
          <IntelList intel={view.intel} nameOf={nameOf} />
        </div>
        <div className="card text-center shrink-0 mb-md" style={{ padding: '14px' }}>
          <div style={{ color: '#ffffff', fontWeight: 800 }}>✅ 你今晚的行動完成了</div>
          <Hint>等所有人都完成，天就亮了。請保持安靜、別讓別人看到你的畫面。</Hint>
        </div>
        {(night.task === 'WOLF_PEEK' || night.task === 'SEER') && Object.keys(revealed).length > 0 && (
          <CenterPicker selected={[]} onPick={() => {}} disabled revealed={revealed} />
        )}
      </>
    );
  } else {
    switch (night.task) {
      case 'WOLF_ACK':
        body = (
          <>
            <Instruction title="🐺 狼人，睜眼看看你的隊友">記清楚誰是狼隊友，白天互相掩護。看完按確認。</Instruction>
            <div className="card shrink-0 mb-md" style={{ padding: '14px' }}><IntelList intel={view.intel} nameOf={nameOf} /></div>
            {confirmBtn('我看完了', () => act({ action: 'NIGHT_ACK' }), true)}
          </>
        );
        break;

      case 'WOLF_PEEK':
        body = (
          <>
            <Instruction title="🐺 你是唯一的狼人">你可以偷看一張中央牌，也可以不看。</Instruction>
            <CenterPicker selected={centerPicked} onPick={i => toggleCenter(i, 1)} disabled={isBusy} />
            {confirmBtn('偷看這張牌', () => act({ action: 'WOLF_PEEK', index: centerPicked[0] }), centerPicked.length === 1)}
            {skipBtn('不偷看', () => act({ action: 'WOLF_PEEK', index: null }))}
          </>
        );
        break;

      case 'MINION_ACK':
        body = (
          <>
            <Instruction title="🦹 爪牙，睜眼看看誰是狼人">狼人不知道你是誰。你要保護他們，別讓狼人被投出局。</Instruction>
            <div className="card shrink-0 mb-md" style={{ padding: '14px' }}><IntelList intel={view.intel} nameOf={nameOf} /></div>
            {confirmBtn('我看完了', () => act({ action: 'NIGHT_ACK' }), true)}
          </>
        );
        break;

      case 'SEER':
        body = (
          <>
            <Instruction title="🔮 預言家，選擇你要查看的牌">看一位玩家的牌，或看兩張中央牌，結果馬上顯示。</Instruction>
            <div style={{ display: 'flex', gap: '8px' }} className="shrink-0 mb-md">
              <button className={`chip-btn ${seerMode === 'PLAYER' ? 'active' : ''}`} onClick={() => { setSeerMode('PLAYER'); setCenterPicked([]); }}>看一位玩家</button>
              <button className={`chip-btn ${seerMode === 'CENTER' ? 'active' : ''}`} onClick={() => { setSeerMode('CENTER'); setPicked([]); }}>看兩張中央牌</button>
            </div>
            {seerMode === 'PLAYER' ? (
              <>
                <PickList players={others} selectedIds={picked} disabled={isBusy} onPick={id => togglePlayer(id, 1)} accent="var(--accent-cyan-light)" />
                {confirmBtn('查看他的牌', () => act({ action: 'SEER_PLAYER', targetId: picked[0] }), picked.length === 1)}
              </>
            ) : (
              <>
                <CenterPicker selected={centerPicked} onPick={i => toggleCenter(i, 2)} disabled={isBusy} />
                {confirmBtn('查看這兩張牌', () => act({ action: 'SEER_CENTER', indices: [centerPicked[0], centerPicked[1]] }), centerPicked.length === 2)}
              </>
            )}
          </>
        );
        break;

      case 'ROBBER':
        body = (
          <>
            <Instruction title="🦝 強盜，選一位玩家交換">你會拿走他的牌，並馬上看到換來的新牌；他則拿到你的強盜牌。</Instruction>
            <PickList players={others} selectedIds={picked} disabled={isBusy} onPick={id => togglePlayer(id, 1)} />
            {confirmBtn('和他交換並查看新牌', () => act({ action: 'ROBBER', targetId: picked[0] }), picked.length === 1)}
            {skipBtn('這晚不行動', () => act({ action: 'ROBBER', targetId: NONE }))}
          </>
        );
        break;

      case 'TROUBLEMAKER':
        body = (
          <>
            <Instruction title="🃏 搗蛋鬼，選另外兩位玩家交換">你不會看到他們的牌，但天亮後兩人的身分已經對調。</Instruction>
            <PickList players={others} selectedIds={picked} disabled={isBusy} onPick={id => togglePlayer(id, 2)} hint={(_, sel) => (sel ? '✔ 交換對象' : '')} />
            {confirmBtn('交換這兩人的牌', () => act({ action: 'TROUBLEMAKER', aId: picked[0], bId: picked[1] }), picked.length === 2)}
            {skipBtn('這晚不行動', () => act({ action: 'TROUBLEMAKER', aId: NONE, bId: NONE }))}
          </>
        );
        break;

      case 'DRUNK':
        body = (
          <>
            <Instruction title="🍺 酒鬼，選一張中央牌交換">你會拿走那張牌，但不能看，你自己也不知道變成什麼了。</Instruction>
            <CenterPicker selected={centerPicked} onPick={i => toggleCenter(i, 1)} disabled={isBusy} />
            {confirmBtn('和這張牌交換', () => act({ action: 'DRUNK', index: centerPicked[0] }), centerPicked.length === 1)}
          </>
        );
        break;

      case 'INSOMNIAC':
        body = (
          <>
            <Instruction title="😵 失眠者，睡不著">等其他人行動完（強盜、搗蛋鬼、酒鬼都可能換走你的牌），天亮前你會看到自己最後的牌。</Instruction>
            {confirmBtn('我睡不著，等天亮', () => act({ action: 'NIGHT_ACK' }), true)}
          </>
        );
        break;

      case 'GUESS':
        body = (
          <>
            <Instruction title="🤔 夜間猜測：你覺得誰是狼？">
              你沒有夜間技能，憑直覺猜一位玩家。猜中「一開始就拿到狼人牌」的人，終局會頒「最佳直覺」。
            </Instruction>
            <PickList players={others} selectedIds={picked} disabled={isBusy} onPick={id => togglePlayer(id, 1)} />
            {confirmBtn('我猜他', () => act({ action: 'GUESS', targetId: picked[0] }), picked.length === 1)}
          </>
        );
        break;
    }
  }

  return (
    <div className="view-container view-enter">
      {header}
      {title}
      {body}
      <div className="mt-auto flex-col gap-sm">
        {hostBar}
        {footer}
      </div>
    </div>
  );
};
