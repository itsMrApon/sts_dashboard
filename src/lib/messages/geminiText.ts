import { GoogleGenerativeAI } from '@google/generative-ai'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'

type Role = 'user' | 'assistant' | 'system'

type Message = {
  role: Role
  content: string
}

const MODEL_FALLBACK = DEFAULT_LLM_MODEL

export type GenerateReplyResult =
  | { ok: true; text: string }
  | { ok: false; error: string; code: 'NO_API_KEY' | 'INVALID_API_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_ERROR' | 'UNKNOWN' }

export async function generateReply(options: {
  userMessage: string
  history: Message[]
  systemPrompt?: string | null
  llmModel?: string | null
  apiKey?: string | null
}): Promise<GenerateReplyResult> {
  const { userMessage, history, systemPrompt, llmModel, apiKey: apiKeyFromCaller } = options

  const apiKey = apiKeyFromCaller?.trim() || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      error: 'GOOGLE_API_KEY is not set in your environment variables. Add it to .env and restart the server.',
      code: 'NO_API_KEY',
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = llmModel || MODEL_FALLBACK
    const model = genAI.getGenerativeModel({
      model: modelName,
      ...(systemPrompt
        ? {
            systemInstruction: {
              role: 'system',
              parts: [{ text: systemPrompt }],
            },
          }
        : {}),
    })

    const chatHistory = history
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }))

    const chat = model.startChat({
      history: chatHistory,
    })

    const result = await chat.sendMessage(userMessage)
    const response = await result.response
    const text = response.text()

    return { ok: true, text }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
      return {
        ok: false,
        error: 'Gemini API key is invalid or revoked. Update it from Config Agent.',
        code: 'INVALID_API_KEY',
      }
    }

    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      return {
        ok: false,
        error: 'Gemini quota exceeded. Wait for reset or upgrade your Google AI billing.',
        code: 'QUOTA_EXCEEDED',
      }
    }

    if (message.includes('models/') || message.includes('not found') || message.includes('is not supported')) {
      return {
        ok: false,
        error: `Model "${llmModel || MODEL_FALLBACK}" is unavailable for this key/project.`,
        code: 'MODEL_ERROR',
      }
    }

    return {
      ok: false,
      error: 'Gemini request failed. Please retry and verify key, model, and quota.',
      code: 'UNKNOWN',
    }
  }
}
