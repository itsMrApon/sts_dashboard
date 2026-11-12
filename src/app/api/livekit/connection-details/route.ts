import { NextResponse } from 'next/server';
import { getLiveKitConnectionDetails } from '@/lib/livekit/livekitVoiceAgent';
import { EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit';
import { embedOptionsForRoom } from '@/lib/embed/cors';
import { guardEmbedRequest, jsonWithCors } from '@/lib/embed/embedRouteGuard';

export const revalidate = 0;

const MAX_ROOM_NAME_LENGTH = 255;

/** LiveKit rooms are `<agentRoom>` or `<agentRoom>-v<n>` (fresh room per call). */
function resolveEmbedRoomName(liveKitRoomName: string): string {
  const match = liveKitRoomName.match(/^(.+)-v\d+$/);
  return match ? match[1] : liveKitRoomName;
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;
}

export async function OPTIONS(req: Request) {
  const url = new URL(req.url);
  const roomName = url.searchParams.get('roomName')?.trim() || '';
  if (!roomName) {
    return new Response(null, { status: 204 });
  }
  return embedOptionsForRoom(req, resolveEmbedRoomName(roomName));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const liveKitRoomName = optionalString(body.roomName, MAX_ROOM_NAME_LENGTH);
    if (!liveKitRoomName) {
      // Never mint LiveKit tokens for arbitrary/random rooms.
      return NextResponse.json({ error: 'roomName is required', code: 'ROOM_REQUIRED' }, { status: 400 });
    }

    const guard = await guardEmbedRequest(req, resolveEmbedRoomName(liveKitRoomName), {
      scope: 'voice',
      perSession: EMBED_RATE_LIMITS.voice,
      perIp: EMBED_RATE_LIMITS.voiceIp,
      dailyQuota: EMBED_DAILY_QUOTAS.voice,
    });
    if (!guard.ok) return guard.response;

    const data = await getLiveKitConnectionDetails({
      roomName: liveKitRoomName,
      participantName: optionalString(body.participantName, 100),
      participantIdentity: optionalString(body.participantIdentity, 100),
      assistantId: optionalString(body.assistantId, 64),
    });

    return jsonWithCors(data, guard.corsHeaders, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[LiveKit connection-details]', error);
    return NextResponse.json({ error: 'Failed to get connection details' }, { status: 500 });
  }
}
