'use server'

import { revalidateTag, unstable_cache } from 'next/cache'
import { aiAgentPrompt } from "@/lib/data"
import { vapiServer } from "@/lib/vapi/vapiServer"

/** Slim fields needed by ai-agents UI (list + ModelConfiguration). */
type CachedVapiAssistant = {
  id: string
  name?: string | null
  firstMessage?: string | null
  model?: { messages?: Array<{ role?: string; content?: string | null }> | null } | null
}

const getAllAssistantsCached = unstable_cache(
  async (): Promise<CachedVapiAssistant[]> => {
    const list = await vapiServer.assistants.list()
    return (list as CachedVapiAssistant[]).map((a) => ({
      id: a.id,
      name: a.name,
      firstMessage: a.firstMessage ?? null,
      model: a.model?.messages
        ? { messages: a.model.messages.map((m) => ({ role: m.role, content: m.content })) }
        : null,
    }))
  },
  ['vapi-assistants-list-v1'],
  { revalidate: 60, tags: ['vapi-assistants'] },
)

export const getAllAssistants = async () => {
  try {
    const getAllAgents = await getAllAssistantsCached()
    return {
      success: true, 
      status: 200, 
      data: getAllAgents,
    }
  } catch (error) {
    console.error('Error getting assistants from VAPI', error)
    return {
      success: false,
      status: 500,
      error: 'Error getting assistants from VAPI',
    }
  }
}

export const createAssistant = async (name: string) => {
try {
  const createAssistant = await vapiServer.assistants.create({
    name,
    firstMessage: `Hi there, this is ${name} from customer support. How can I help you today?`,
    serverMessages: [],
    voice: {
      provider: 'deepgram',
      voiceId: 'asteria',
    },
    model: {
      model: 'gpt-4o',
      provider: 'openai',
      messages: [
        {
          role: 'system',
          content: aiAgentPrompt,
        },
      ],
      temperature: 0.5,
    }
  })
  revalidateTag('vapi-assistants')
  return { success: true, status: 200, data: createAssistant }
} catch (error) {
  console.error('Error creating assistant:', error)
  return { success: false, status: 500, error: 'Error creating assistant' }
}
}

export const updateAssistant = async (
  assistantId: string, 
  firstMessage: string,
  systemPrompt: string) => {
  try {
    const updateAssistant = await vapiServer.assistants.update(assistantId, {
      firstMessage: firstMessage,
      serverMessages: [],
      voice: {
        provider: 'deepgram',
        voiceId: 'asteria',
      },
      model: {
        model: 'gpt-4o',
        provider: 'openai',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
        ],
      },
    })
    revalidateTag('vapi-assistants')
    return { success: true, status: 200, data: updateAssistant }
  } catch (error) {
    console.error('Error updating assistant:', error)
    return { success: false, status: 500, message: 'Error updating assistant', error: error }
  }
}

export const deleteAssistant = async (assistantId: string) => {
  try {
    await vapiServer.assistants.delete(assistantId)
    revalidateTag('vapi-assistants')
    return { success: true, status: 200 }
  } catch (error) {
    console.error('Error deleting assistant:', error)
    return { success: false, status: 500, error: 'Error deleting assistant' }
  }
}
