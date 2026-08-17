import { NextResponse } from 'next/server';
import { getLiveKitConnectionDetails } from '@/lib/livekit/livekitVoiceAgent';
import { EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit';
import { embedCorsHeadersForRoom, embedOptionsForRoom } from '@/lib/embed/cors';
import {
  clientIp,
  guardEmbedRequest,
  jsonWithCors,
} from '@/lib/embed/embedRouteGuard';

export const revalidate = 0;

function resolveEmbedRoomName(liveKitRoomName: string): string {
  const match = liveKitRoomName.match(/^(.+)-v\d+$/);
  return match ? match[1] : liveKitRoomName;
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
    const liveKitRoomName = typeof body.roomName === 'string' ? body.roomName : '';
    const embedRoomName = liveKitRoomName ? resolveEmbedRoomName(liveKitRoomName) : '';

    const guard = embedRoomName
      ? await guardEmbedRequest(req, embedRoomName, {
          key: `embed:voice:${embedRoomName}:${clientIp(req)}`,
          limit: EMBED_RATE_LIMITS.voice.limit,
          windowMs: EMBED_RATE_LIMITS.voice.windowMs,
        })
      : null;

    if (guard && !guard.ok) return guard.response;

    const data = await getLiveKitConnectionDetails({
      roomName: body.roomName,
      participantName: body.participantName,
      participantIdentity: body.participantIdentity,
      assistantId: body.assistantId,
    });

    if (guard?.ok) {
      return jsonWithCors(data, guard.corsHeaders, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (embedRoomName) {
      const corsHeaders = await embedCorsHeadersForRoom(req, embedRoomName);
      return jsonWithCors(data, corsHeaders, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[LiveKit connection-details]', error);
    const message = error instanceof Error ? error.message : 'Failed to get connection details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
