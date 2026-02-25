'use server'

import { aiAgentPrompt } from "@/lib/data"
import { vapiServer } from "@/lib/vapi/vapiServer"

export const getAllAssistants = async () => {
  try {
    const getAllAgents = await vapiServer.assistants.list()
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
    return { success: true, status: 200, data: updateAssistant }
  } catch (error) {
    console.error('Error updating assistant:', error)
    return { success: false, status: 500, message: 'Error updating assistant', error: error }
  }
}
