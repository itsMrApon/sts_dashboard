'use server';

import { prismaClient } from '@/lib/prismaClient';
import { aiAgentPrompt } from '@/lib/data';
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes';
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel';

function generateUniqueRoomName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const shortId = Math.random().toString(36).slice(2, 8);
  return `room-${slug || 'agent'}-${shortId}`;
}

function mapToUiConfig(agent: {
  id: string;
  name: string;
  roomName: string;
  firstMessage: string | null;
  systemPrompt: string | null;
  language: string;
  voiceProvider: string;
  voiceModel: string;
  llmModel: string;
  llmProvider: string;
}): LiveKitUiAgentConfig {
  return {
    id: agent.id,
    name: agent.name,
    roomName: agent.roomName,
    firstMessage: agent.firstMessage ?? '',
    systemPrompt: agent.systemPrompt ?? aiAgentPrompt,
    language: agent.language,
    voiceProvider: agent.voiceProvider,
    voiceModel: agent.voiceModel,
    llmModel: agent.llmModel,
    llmProvider: agent.llmProvider,
  };
}

export const getLiveKitAgents = async () => {
  try {
    const agents = await (prismaClient as any).liveKitAgent.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return {
      success: true,
      status: 200,
      data: agents.map((a: Parameters<typeof mapToUiConfig>[0]) => mapToUiConfig(a)),
    };
  } catch (error) {
    console.error('Error getting LiveKit agents', error);
    return {
      success: false,
      status: 500,
      error: 'Error getting LiveKit agents',
      data: [] as LiveKitUiAgentConfig[],
    };
  }
};

export const getLiveKitAgentById = async (id: string) => {
  try {
    const agent = await (prismaClient as any).liveKitAgent.findUnique({
      where: { id },
    });
    if (!agent) return { success: false, status: 404, error: 'Agent not found' };
    return { success: true, status: 200, data: mapToUiConfig(agent) };
  } catch (error) {
    console.error('Error getting LiveKit agent', error);
    return { success: false, status: 500, error: 'Error getting LiveKit agent' };
  }
};

/** @deprecated Use getLiveKitAgents. Kept for backward compatibility. */
export const getLiveKitAgent = async () => {
  const result = await getLiveKitAgents();
  if (result.success && result.data.length > 0) {
    return { ...result, data: result.data[0] };
  }
  return { success: false, status: 500, error: 'No LiveKit agent found' };
};

export const createLiveKitAgent = async (name: string) => {
  try {
    const created = await (prismaClient as any).liveKitAgent.create({
      data: {
        name,
        roomName: generateUniqueRoomName(name),
        firstMessage:
          'Hey there! This is your AI sales agent. I’ll ask a few quick questions to see if this is a good fit. Sounds fair?',
        systemPrompt: aiAgentPrompt,
        language: 'en',
        voiceProvider: 'deepgram',
        voiceModel: 'aura-asteria-en',
        llmModel: DEFAULT_LLM_MODEL,
        llmProvider: 'google',
      },
    });

    return {
      success: true,
      status: 200,
      data: mapToUiConfig(created),
    };
  } catch (error) {
    console.error('Error creating LiveKit agent config', error);
    return {
      success: false,
      status: 500,
      error: 'Error creating LiveKit agent config',
    };
  }
};

export const updateLiveKitAgent = async (
  id: string,
  data: Partial<
    Pick<
      LiveKitUiAgentConfig,
      | 'firstMessage'
      | 'systemPrompt'
      | 'language'
      | 'voiceProvider'
      | 'voiceModel'
      | 'llmModel'
      | 'llmProvider'
    >
  >
) => {
  try {
    const updated = await (prismaClient as any).liveKitAgent.update({
      where: { id },
      data: {
        firstMessage: data.firstMessage,
        systemPrompt: data.systemPrompt,
        language: data.language,
        voiceProvider: data.voiceProvider,
        voiceModel: data.voiceModel,
        llmModel: data.llmModel,
        llmProvider: data.llmProvider,
      },
    });

    return {
      success: true,
      status: 200,
      data: mapToUiConfig(updated),
    };
  } catch (error) {
    console.error('Error updating LiveKit agent config', error);
    return {
      success: false,
      status: 500,
      error: 'Error updating LiveKit agent config',
    };
  }
};

export const deleteLiveKitAgent = async (id: string) => {
  try {
    await (prismaClient as any).liveKitAgent.delete({
      where: { id },
    });
    return { success: true, status: 200 };
  } catch (error) {
    console.error('Error deleting LiveKit agent config', error);
    return {
      success: false,
      status: 500,
      error: 'Error deleting LiveKit agent config',
    };
  }
};

