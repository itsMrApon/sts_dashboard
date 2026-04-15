import { NextResponse } from 'next/server';
import { getLiveKitConnectionDetails } from '@/lib/livekit/livekitVoiceAgent';

export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = await getLiveKitConnectionDetails({
      roomName: body.roomName,
      participantName: body.participantName,
      participantIdentity: body.participantIdentity,
      assistantId: body.assistantId,
    });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[LiveKit connection-details]', error);
    const message = error instanceof Error ? error.message : 'Failed to get connection details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
