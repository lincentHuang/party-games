// lib/playerIdentity.ts
// 這支手機的玩家身分：id 對外公開，secret 只送給伺服器驗證本人
'use client';

export interface StoredPlayer {
  id: string;
  name: string;
  secret: string;
}

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, length * 2);
}

export function getStoredPlayer(): StoredPlayer {
  if (typeof window === 'undefined') {
    return { id: 'player_server', name: '玩家', secret: '' };
  }
  let id = localStorage.getItem('party_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('party_player_id', id);
  }
  let name = localStorage.getItem('party_player_name') || '';
  if (!name) {
    name = '特工 ' + id.substring(2, 5).toUpperCase();
    localStorage.setItem('party_player_name', name);
  }
  let secret = localStorage.getItem('party_player_secret') || '';
  if (!secret) {
    secret = randomToken(16);
    localStorage.setItem('party_player_secret', secret);
  }
  return { id, name, secret };
}

export function savePlayerName(name: string): string {
  const clean = name.trim().substring(0, 12);
  if (clean && typeof window !== 'undefined') {
    localStorage.setItem('party_player_name', clean);
    localStorage.setItem('party_player_named', '1');
  }
  return clean;
}

// 玩家是否自己取過暱稱（沒取過的話掃碼進房前先讓他填名字）
export function hasChosenName(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('party_player_named') === '1';
}
