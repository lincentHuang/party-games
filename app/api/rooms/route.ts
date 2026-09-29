// app/api/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/lib/roomStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gameType, playerId, playerName, maxPlayers, title } = body;

    if (!gameType || !playerId) {
      return NextResponse.json({ success: false, message: '缺少必要參數' }, { status: 400 });
    }

    const room = roomStore.createRoom(gameType, { id: playerId, name: playerName || '房主' }, maxPlayers, title);

    return NextResponse.json({
      success: true,
      room
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
