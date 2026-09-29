// app/api/rooms/[roomId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { roomStore } from '@/lib/roomStore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = roomStore.getRoom(roomId);

    if (!room) {
      return NextResponse.json({ success: false, message: '房間不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await req.json();
    const { action, player, playerId, gameState, status, event, isReady, team } = body;

    switch (action) {
      case 'JOIN': {
        if (!player || !player.id) {
          return NextResponse.json({ success: false, message: '玩家資訊無效' }, { status: 400 });
        }
        const result = roomStore.joinRoom(roomId, player);
        if (!result.success) {
          return NextResponse.json({ success: false, message: result.message }, { status: 400 });
        }
        return NextResponse.json({ success: true, room: result.room });
      }

      case 'HEARTBEAT': {
        if (!playerId) {
          return NextResponse.json({ success: false, message: '缺少 playerId' }, { status: 400 });
        }
        const updatedRoom = roomStore.heartbeat(roomId, playerId, isReady, team);
        return NextResponse.json({ success: !!updatedRoom, room: updatedRoom });
      }

      case 'UPDATE_STATE': {
        const updatedRoom = roomStore.updateGameState(roomId, gameState, status, event);
        return NextResponse.json({ success: !!updatedRoom, room: updatedRoom });
      }

      case 'LEAVE': {
        if (!playerId) {
          return NextResponse.json({ success: false, message: '缺少 playerId' }, { status: 400 });
        }
        const remainingRoom = roomStore.leaveRoom(roomId, playerId);
        return NextResponse.json({ success: true, room: remainingRoom });
      }

      default:
        return NextResponse.json({ success: false, message: '未知的操作指令' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
