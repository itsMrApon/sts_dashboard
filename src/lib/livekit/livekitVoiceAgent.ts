/**
 * LiveKit Voice Agent – integration for your Next.js SaaS
 * Uses room name to load config. Point Python agent's SAAS_API_URL to this app for dynamic config.
 *
 * NOTE: This file is **server-only** because it depends on `livekit-server-sdk`
 * and Node built-ins (e.g. `node:crypto`). Do not import it from client components.
 * For client-side helpers, use `livekitClient.ts` instead.
 */

import { AccessToken, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { aiAgentPrompt } from '@/lib/data';

export interface LiveKitAgentConfig {
  room_name: string;
  business_type: string;
  instructions: string;
  language?: string;
  voice_provider?: string;
  voice_model?: string;
  enabled_mcp_servers?: string[];
  tenant_env?: Record<string, string>;
}

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export function getAgentConfigByRoom(roomName: string): LiveKitAgentConfig {
  return {
    room_name: roomName,
    business_type: 'Sales & Lead Qualification',
    instructions: aiAgentPrompt,
    language: 'en',
    voice_provider: 'deepgram',
    voice_model: 'aura-asteria-en',
    enabled_mcp_servers: [],
  };
}

const getEnv = () => {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) {
    throw new Error('Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET');
  }
  return { url, key, secret };
};

export async function createLiveKitToken(
  roomName: string,
  participantIdentity: string,
  participantName: string,
  agentName?: string
): Promise<string> {
  const { key, secret } = getEnv();
  const at = new AccessToken(key, secret, {
    identity: participantIdentity,
    name: participantName,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  if (agentName !== undefined) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName: agentName || '' }],
    });
  }
  return at.toJwt();
}

export async function getLiveKitConnectionDetails(body: {
  roomName?: string;
  participantName?: string;
  participantIdentity?: string;
  assistantId?: string;
}): Promise<ConnectionDetails> {
  const { url } = getEnv();
  const roomName = body.roomName ?? `voice_room_${Math.floor(Math.random() * 100_000)}`;
  const participantName = body.participantName ?? 'user';
  const participantIdentity =
    body.participantIdentity ?? `user_${Math.floor(Math.random() * 100_000)}`;

  const token = await createLiveKitToken(
    roomName,
    participantIdentity,
    participantName,
    // Default to explicit worker name for reliable dispatch on arbitrary rooms.
    body.assistantId ?? 'saas-agent'
  );

  return {
    serverUrl: url,
    roomName,
    participantName,
    participantToken: token,
  };
}

// Client-side helpers live in `livekitClient.ts` to avoid bundling server-only
// dependencies into the browser.
