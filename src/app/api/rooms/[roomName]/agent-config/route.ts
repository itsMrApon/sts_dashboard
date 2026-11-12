import { NextResponse } from 'next/server';
import { getAgentConfigByRoom } from '@/lib/livekit/livekitVoiceAgent';
import { prismaClient } from '@/lib/prismaClient';
import { aiAgentPrompt } from '@/lib/data';
import { buildAgentContext } from '@/lib/messages/buildAgentContext';
import { decryptToken } from '@/lib/messages/encrypt';
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo';
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId';
import { resolveAgentEngine } from '@/lib/agents/engineSettings';
import { parseOfferRoomName } from '@/lib/offers/offerAi';
import { buildOfferBrief } from '@/lib/offers/offerAiBrief';
import { loadPublicOffer } from '@/lib/offers/publicOffer';

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
    // Offer share-page calls: <agentRoom>__offer__<slug>__<random>
    const offerRoom = parseOfferRoomName(roomName);
    const baseRoomName = offerRoom
      ? offerRoom.baseRoomName
      : roomName.split('__voice__')[0].replace(/-v\d+$/u, '');
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
      // LLM + voice are account-wide (AI Agents → Config); legacy agent columns are the fallback.
      const engine = await resolveAgentEngine(livekitAgent, userId);

      const userCredential = userId
        ? await getUserVoiceCredentialByUserId(userId)
        : null;

      const tenantEnv: Record<string, string> = {};
      const googleApiKey = safeDecrypt(userCredential?.googleApiKey) || process.env.GOOGLE_API_KEY || null;
      const deepgramApiKey = safeDecrypt(userCredential?.deepgramApiKey) || process.env.DEEPGRAM_API_KEY || null;
      const openaiApiKey = safeDecrypt(userCredential?.openaiApiKey) || process.env.OPENAI_API_KEY || null;
      const anthropicApiKey = safeDecrypt(userCredential?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY || null;
      const fishApiKey = safeDecrypt(userCredential?.fishApiKey) || process.env.FISH_API_KEY || null;
      const deepseekApiKey =
        safeDecrypt(userCredential?.deepseekApiKey) || process.env.DEEPSEEK_API_KEY || null;
      const kimiApiKey =
        safeDecrypt(userCredential?.kimiApiKey) ||
        process.env.MOONSHOT_API_KEY ||
        process.env.KIMI_API_KEY ||
        null;
      const openrouterApiKey =
        safeDecrypt(userCredential?.openrouterApiKey) || process.env.OPENROUTER_API_KEY || null;
      if (googleApiKey) tenantEnv.GOOGLE_API_KEY = googleApiKey;
      if (openrouterApiKey) tenantEnv.OPENROUTER_API_KEY = openrouterApiKey;
      const xaiApiKey = safeDecrypt(userCredential?.xaiApiKey) || process.env.XAI_API_KEY || null;
      if (xaiApiKey) tenantEnv.XAI_API_KEY = xaiApiKey;
      if (deepgramApiKey) tenantEnv.DEEPGRAM_API_KEY = deepgramApiKey;
      if (openaiApiKey) tenantEnv.OPENAI_API_KEY = openaiApiKey;
      if (anthropicApiKey) tenantEnv.ANTHROPIC_API_KEY = anthropicApiKey;
      if (fishApiKey) tenantEnv.FISH_API_KEY = fishApiKey;
      if (deepseekApiKey) tenantEnv.DEEPSEEK_API_KEY = deepseekApiKey;
      if (kimiApiKey) {
        tenantEnv.MOONSHOT_API_KEY = kimiApiKey;
        tenantEnv.KIMI_API_KEY = kimiApiKey;
      }

      const linkedProject = await prismaClient.webinar.findFirst({
        where: { livekitAgentId: livekitAgent.id, deletedAt: null },
        select: { id: true },
      })

      // Only brief the agent on an offer it actually sells (the slug comes from the room name).
      const offer = offerRoom ? await loadPublicOffer(offerRoom.offerSlug) : null;
      const offerForAgent = offer?.live && offer.agentRoomName === baseRoomName ? offer : null;
      const baseInstructions = context.systemInstruction || livekitAgent.systemPrompt || aiAgentPrompt;
      const config = {
        room_name: livekitAgent.roomName,
        business_type: 'Sales & Lead Qualification',
        instructions: offerForAgent
          ? `${baseInstructions}\n\n${buildOfferBrief(
              {
                title: offerForAgent.title,
                description: offerForAgent.description,
                businessName: offerForAgent.business.name,
                prices: offerForAgent.prices,
              },
              'voice',
            )}`
          : baseInstructions,
        // Turns on the agent's show_order_button tool (it messages the buyer's page).
        offer_slug: offerForAgent?.slug ?? null,
        offer_title: offerForAgent?.title ?? null,
        language: livekitAgent.language || 'en',
        voice_provider: engine.voiceProvider,
        voice_model: engine.voiceModel,
        llm_model: engine.llmModel,
        llm_provider: engine.llmProvider,
        engine_mode: engine.mode,
        stt_provider: engine.sttProvider,
        stt_model: engine.sttModel,
        voice_style: engine.voiceStyle,
        realtime_provider: engine.realtimeProvider,
        realtime_model: engine.realtimeModel,
        realtime_voice: engine.realtimeVoice,
        enabled_mcp_servers: [] as string[],
        tenant_env: tenantEnv,
        first_message: livekitAgent.firstMessage || null,
        user_id: userId,
        transcript_ingest_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/transcripts/ingest`,
        transcript_api_key: process.env.N8N_API_KEY || '',
        usage_ingest_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/usage/ingest`,
        usage_surface: linkedProject ? 'projects' : 'messages',
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
