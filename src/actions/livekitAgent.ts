'use server';

import { revalidateTag, unstable_cache } from 'next/cache';
import { prismaClient } from '@/lib/prismaClient';
import { aiAgentPrompt } from '@/lib/data';
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes';
import { onAuthenticateUser } from '@/actions/auth';
import { ensureAgentEditAccess } from '@/lib/agents/agentAccess';
import { getEngineForUser } from '@/lib/agents/engineSettings';
import { isAgentLanguage } from '@/lib/agents/engineOptions';
import { AI_INSTRUCTION_MAX, isAgentAiQuickAction } from '@/lib/agents/agentAiActions';
import { editAgentTextWithAi } from '@/lib/agents/agentTextAi';
import {
  isDatabaseConnectivityError,
  logDatabaseConnectivityFailure,
} from '@/lib/prismaErrors';

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

const LIVEKIT_AGENT_SELECT = {
  id: true,
  name: true,
  roomName: true,
  firstMessage: true,
  systemPrompt: true,
  language: true,
  voiceProvider: true,
  voiceModel: true,
  llmModel: true,
  llmProvider: true,
  userId: true,
} as const;

const FIRST_MESSAGE_MAX = 1_000;
const SYSTEM_PROMPT_MAX = 40_000;

async function currentUserId(): Promise<string | null> {
  const authResult = await onAuthenticateUser();
  return authResult.user?.id ?? null;
}

const getLiveKitAgentsCached = unstable_cache(
  async () => {
    try {
      const agents = await prismaClient.liveKitAgent.findMany({
        orderBy: { createdAt: 'asc' },
        select: LIVEKIT_AGENT_SELECT,
      });
      return agents.map((a) => ({ ...mapToUiConfig(a), ownerUserId: a.userId }));
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        // Soft error so Next cache revalidation does not dump Prisma stacks.
        throw new Error('DATABASE_UNAVAILABLE');
      }
      throw error;
    }
  },
  ['livekit-agents-list-v2'],
  { revalidate: 30, tags: ['livekit-agents'] },
);

/** Agents the signed-in user owns, plus legacy unowned agents (claimed on first edit). */
export const getLiveKitAgents = async () => {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return { success: false, status: 401, error: 'UNAUTHENTICATED', data: [] as LiveKitUiAgentConfig[] };
    }
    const all = await getLiveKitAgentsCached();
    const data: LiveKitUiAgentConfig[] = all
      .filter((agent) => agent.ownerUserId === null || agent.ownerUserId === userId)
      .map((agent) => mapToUiConfig(agent));
    return {
      success: true,
      status: 200,
      data,
    };
  } catch (error) {
    if (isDatabaseConnectivityError(error) || (error instanceof Error && error.message === 'DATABASE_UNAVAILABLE')) {
      logDatabaseConnectivityFailure('getLiveKitAgents', error);
    } else {
      console.warn(
        '[getLiveKitAgents]',
        error instanceof Error ? error.message : String(error),
      );
    }
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
    const agent = await prismaClient.liveKitAgent.findUnique({
      where: { id },
      select: LIVEKIT_AGENT_SELECT,
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
    const userId = await currentUserId();
    if (!userId) return { success: false, status: 401, error: 'UNAUTHENTICATED' };
    const trimmedName = name.trim().slice(0, 255);
    if (!trimmedName) return { success: false, status: 400, error: 'Agent name is required' };
    // New agents start on the account-wide engine from Settings.
    const { engine } = await getEngineForUser(userId);
    const created = await prismaClient.liveKitAgent.create({
      data: {
        userId,
        name: trimmedName,
        roomName: generateUniqueRoomName(trimmedName),
        firstMessage:
          'Hey there! This is your AI sales agent. I’ll ask a few quick questions to see if this is a good fit. Sounds fair?',
        systemPrompt: aiAgentPrompt,
        language: 'en',
        ...engine,
      },
      select: LIVEKIT_AGENT_SELECT,
    });

    revalidateTag('livekit-agents');
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

export type LiveKitAgentBehaviorUpdate = {
  firstMessage?: string;
  systemPrompt?: string;
  language?: string;
};

/**
 * Per-agent behavior only (first message, prompt, language). The LLM + voice engine is
 * account-wide and saved from AI Agents → Config (see saveAgentEngineSettings).
 */
export const updateLiveKitAgent = async (id: string, update: LiveKitAgentBehaviorUpdate) => {
  try {
    const userId = await currentUserId();
    if (!userId) return { success: false, status: 401, error: 'Please sign in again.' };

    const access = await ensureAgentEditAccess(id, userId);
    if (!access.ok) {
      return access.reason === 'NOT_FOUND'
        ? { success: false, status: 404, error: 'Agent not found.' }
        : { success: false, status: 403, error: 'You do not have access to this agent.' };
    }

    if (update.language !== undefined && !isAgentLanguage(update.language)) {
      return { success: false, status: 400, error: 'Language must be Bangla or English.' };
    }
    if (update.firstMessage !== undefined && update.firstMessage.length > FIRST_MESSAGE_MAX) {
      return { success: false, status: 400, error: `First message is over ${FIRST_MESSAGE_MAX} characters.` };
    }
    if (update.systemPrompt !== undefined && update.systemPrompt.length > SYSTEM_PROMPT_MAX) {
      return { success: false, status: 400, error: `System prompt is over ${SYSTEM_PROMPT_MAX} characters.` };
    }

    // Text is stored exactly as typed (no trimming/normalization) so Bangla content round-trips intact.
    const updated = await prismaClient.liveKitAgent.update({
      where: { id: access.agentId },
      data: {
        firstMessage: update.firstMessage,
        systemPrompt: update.systemPrompt,
        language: update.language,
      },
      select: LIVEKIT_AGENT_SELECT,
    });

    revalidateTag('livekit-agents');
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
    const userId = await currentUserId();
    if (!userId) return { success: false, status: 401, error: 'UNAUTHENTICATED' };
    const access = await ensureAgentEditAccess(id, userId);
    if (!access.ok) {
      return { success: false, status: access.reason === 'NOT_FOUND' ? 404 : 403, error: 'Agent not found or not yours.' };
    }
    await prismaClient.liveKitAgent.delete({
      where: { id: access.agentId },
    });
    revalidateTag('livekit-agents');
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


/**
 * "Edit with AI" for the Model section. Returns a proposed rewrite only — nothing is saved;
 * the client shows a diff and the creator accepts or discards it.
 */
export const editLiveKitAgentTextWithAi = async (input: {
  agentId: string;
  field: string;
  quickAction?: string | null;
  instruction?: string;
  currentText: string;
  systemPromptContext?: string;
  language: string;
}) => {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: 'Please sign in again.' };

  if (input.field !== 'systemPrompt' && input.field !== 'firstMessage') {
    return { ok: false as const, error: 'Unknown field.' };
  }
  const quickAction = input.quickAction ? input.quickAction : null;
  if (quickAction !== null && !isAgentAiQuickAction(quickAction)) {
    return { ok: false as const, error: 'Unknown AI action.' };
  }
  const instruction = (input.instruction ?? '').slice(0, AI_INSTRUCTION_MAX);
  if (!quickAction && !instruction.trim()) {
    return { ok: false as const, error: 'Tell the AI what to change, or pick a quick action.' };
  }
  const maxLength = input.field === 'systemPrompt' ? SYSTEM_PROMPT_MAX : FIRST_MESSAGE_MAX;
  if (typeof input.currentText !== 'string' || input.currentText.length > maxLength) {
    return { ok: false as const, error: 'Text is too long to edit.' };
  }

  const access = await ensureAgentEditAccess(input.agentId, userId);
  if (!access.ok) return { ok: false as const, error: 'Agent not found or not yours.' };

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { id: access.agentId },
    select: { name: true },
  });

  try {
    return await editAgentTextWithAi({
      userId,
      roomName: access.roomName,
      agentName: agent?.name ?? 'AI agent',
      field: input.field,
      quickAction,
      instruction,
      currentText: input.currentText,
      systemPromptContext: (input.systemPromptContext ?? '').slice(0, SYSTEM_PROMPT_MAX),
      language: isAgentLanguage(input.language) ? input.language : 'en',
    });
  } catch (error) {
    console.error('[editLiveKitAgentTextWithAi]', error);
    return { ok: false as const, error: 'AI edit failed. Please try again.' };
  }
};
