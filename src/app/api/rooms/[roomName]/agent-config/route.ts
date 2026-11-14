import { NextResponse } from 'next/server';
import { getAgentConfigByRoom } from '@/lib/livekit/livekitVoiceAgent';
import { prismaClient } from '@/lib/prismaClient';
import { aiAgentPrompt } from '@/lib/data';
import { buildAgentContext } from '@/lib/messages/buildAgentContext';
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo';
import { resolveRoomOwnerUserId } from '@/lib/messages/resolveRoomOwnerUserId';
import { resolveAgentEngine } from '@/lib/agents/engineSettings';
import { parseOfferRoomName } from '@/lib/offers/offerAi';
import { buildOfferBrief } from '@/lib/offers/offerAiBrief';
import { loadPublicOffer } from '@/lib/offers/publicOffer';
import { ALL_KEY_PROVIDERS, PROVIDER_ENV_NAMES, savedKeyFor } from '@/lib/credentials/providerKeys';
import { baseAgentRoomName } from '@/lib/credentials/voiceKeyCheck';
import { getBusinessByRoomName } from '@/lib/business/creatorBusiness';
import { getBusinessServices } from '@/lib/services/serviceConfig';
import { speakStyleInstruction } from '@/lib/services/persona';

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
    const baseRoomName = baseAgentRoomName(roomName);
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

      // Only the creator's own saved keys reach the worker — never the platform's .env keys.
      const tenantEnv: Record<string, string> = {};
      for (const provider of ALL_KEY_PROVIDERS) {
        const key = savedKeyFor(userCredential, provider);
        if (!key) continue;
        for (const envName of PROVIDER_ENV_NAMES[provider]) tenantEnv[envName] = key;
      }

      const linkedProject = await prismaClient.webinar.findFirst({
        where: { livekitAgentId: livekitAgent.id, deletedAt: null },
        select: { id: true },
      })

      // Only brief the agent on an offer it actually sells (the slug comes from the room name).
      const offer = offerRoom ? await loadPublicOffer(offerRoom.offerSlug) : null;
      const offerForAgent = offer?.live && offer.agentRoomName === baseRoomName ? offer : null;
      const agentInstructions = context.systemInstruction || livekitAgent.systemPrompt || aiAgentPrompt;
      // Business calls (Speak AI) use the voice style set in Messages → Speak AI.
      const business = offerForAgent ? null : await getBusinessByRoomName(baseRoomName);
      const baseInstructions = business
        ? `${agentInstructions}\n\n${speakStyleInstruction((await getBusinessServices(business.workspaceId)).speak.config)}`
        : agentInstructions;
      const config = {
        // Offer calls keep the full room name so their transcript can be matched to the buyer.
        room_name: offerForAgent ? roomName : livekitAgent.roomName,
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
