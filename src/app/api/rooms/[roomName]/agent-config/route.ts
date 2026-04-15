import { NextResponse } from 'next/server';
import { getAgentConfigByRoom } from '@/lib/livekit/livekitVoiceAgent';
import { prismaClient } from '@/lib/prismaClient';
import { aiAgentPrompt } from '@/lib/data';
import { buildAgentContext } from '@/lib/messages/buildAgentContext';
import { decryptToken } from '@/lib/messages/encrypt';
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo';
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId';
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel';

function safeDecrypt(value: string | null | undefined): string | null {
  try {
    return decryptToken(value);
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> }
) {
  try {
    const { roomName } = await params;
    // Allow ephemeral voice room names while resolving config from base room.
    // Example: room-apon-7eom6m__voice__abc123 -> room-apon-7eom6m
    // Example: room-apon-7eom6m-v2 (per-call LiveKit room) -> room-apon-7eom6m
    const baseRoomName = roomName.split('__voice__')[0].replace(/-v\d+$/u, '');
    const authHeader = req.headers.get('authorization');
    const expected = process.env.SAAS_API_KEY;
    if (expected && authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const livekitAgent = await prismaClient.liveKitAgent.findFirst({
      where: { roomName: baseRoomName },
    });

    if (livekitAgent) {
      const context = await buildAgentContext(baseRoomName);

      const userId = await resolveRoomOwnerUserId(livekitAgent.id, baseRoomName);

      const userCredential = userId
        ? await getUserVoiceCredentialByUserId(userId)
        : null;

      const tenantEnv: Record<string, string> = {};
      const googleApiKey = safeDecrypt(userCredential?.googleApiKey) || process.env.GOOGLE_API_KEY || null;
      const deepgramApiKey = safeDecrypt(userCredential?.deepgramApiKey) || process.env.DEEPGRAM_API_KEY || null;
      const openaiApiKey = safeDecrypt(userCredential?.openaiApiKey) || process.env.OPENAI_API_KEY || null;
      const anthropicApiKey = safeDecrypt(userCredential?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY || null;
      if (googleApiKey) tenantEnv.GOOGLE_API_KEY = googleApiKey;
      if (deepgramApiKey) tenantEnv.DEEPGRAM_API_KEY = deepgramApiKey;
      if (openaiApiKey) tenantEnv.OPENAI_API_KEY = openaiApiKey;
      if (anthropicApiKey) tenantEnv.ANTHROPIC_API_KEY = anthropicApiKey;

      const agentRow = livekitAgent as typeof livekitAgent & { voiceProvider?: string }
      const config = {
        room_name: livekitAgent.roomName,
        business_type: 'Sales & Lead Qualification',
        instructions: context.systemInstruction || livekitAgent.systemPrompt || aiAgentPrompt,
        language: livekitAgent.language || 'en',
        voice_provider: agentRow.voiceProvider || 'deepgram',
        voice_model: livekitAgent.voiceModel || 'aura-asteria-en',
        llm_model: livekitAgent.llmModel || DEFAULT_LLM_MODEL,
        llm_provider: livekitAgent.llmProvider || 'google',
        enabled_mcp_servers: [] as string[],
        tenant_env: tenantEnv,
        first_message: livekitAgent.firstMessage || null,
        user_id: userId,
        transcript_ingest_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/transcripts/ingest`,
        transcript_api_key: process.env.N8N_API_KEY || '',
      };

      return NextResponse.json(config);
    }

    const config = getAgentConfigByRoom(baseRoomName);
    return NextResponse.json(config);
  } catch (error) {
    console.error('[agent-config]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Config error' },
      { status: 500 }
    );
  }
}
