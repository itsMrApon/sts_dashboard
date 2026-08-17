import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
} from '@google/generative-ai'
import { DEFAULT_LLM_MODEL } from '@/lib/llm/defaultModel'
import {
  llmProviderFromModel,
  recordProviderUsageLater,
} from '@/lib/usage/providerUsage'

type Role = 'user' | 'assistant' | 'system'

type Message = {
  role: Role
  content: string
}

const MODEL_FALLBACK = DEFAULT_LLM_MODEL

export type GenerateReplyResult =
  | { ok: true; text: string }
  | { ok: false; error: string; code: 'NO_API_KEY' | 'INVALID_API_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_ERROR' | 'UNKNOWN' }

export type ToolDeclaration = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type RequestedToolCall = {
  name: string
  args: Record<string, unknown>
}

export type GenerateReplyWithToolsResult =
  | {
      ok: true
      text: string
      requestedTools: RequestedToolCall[]
    }
  | { ok: false; error: string; code: 'NO_API_KEY' | 'INVALID_API_KEY' | 'QUOTA_EXCEEDED' | 'MODEL_ERROR' | 'UNKNOWN' }

function mapGeminiError(err: unknown, llmModel?: string | null): GenerateReplyResult {
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

function estimateTokensFromText(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.max(1, Math.ceil(trimmed.length / 4))
}

function usageFromGeminiResponse(
  response: {
    usageMetadata?: {
      promptTokenCount?: number
      candidatesTokenCount?: number
    }
  },
  fallbackInput: string,
  fallbackOutput: string,
): { input: number; output: number } {
  const input = Number(response.usageMetadata?.promptTokenCount || 0)
  const output = Number(response.usageMetadata?.candidatesTokenCount || 0)
  if (input > 0 || output > 0) {
    return {
      input: Math.max(0, Math.floor(input)),
      output: Math.max(0, Math.floor(output)),
    }
  }
  return {
    input: estimateTokensFromText(fallbackInput),
    output: estimateTokensFromText(fallbackOutput),
  }
}

function recordLlmUsage(options: {
  accountUserId?: string | null
  llmModel?: string | null
  usageSurface?: string | null
  inputUnits: number
  outputUnits: number
}) {
  const userId = options.accountUserId?.trim()
  if (!userId) return
  recordProviderUsageLater({
    userId,
    provider: llmProviderFromModel(options.llmModel),
    kind: 'llm',
    surface: options.usageSurface,
    requestCount: 1,
    inputUnits: options.inputUnits,
    outputUnits: options.outputUnits,
  })
}

function toFunctionDeclarations(tools: ToolDeclaration[]): FunctionDeclaration[] {
  return tools.map((tool) => {
    const raw = tool.parameters || {}
    const properties =
      typeof raw.properties === 'object' && raw.properties
        ? (raw.properties as Record<string, unknown>)
        : {}
    const required = Array.isArray(raw.required)
      ? raw.required.filter((r): r is string => typeof r === 'string')
      : undefined

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties,
        ...(required && required.length > 0 ? { required } : {}),
      },
    } as FunctionDeclaration
  })
}

export async function generateReply(options: {
  userMessage: string
  history: Message[]
  systemPrompt?: string | null
  llmModel?: string | null
  apiKey?: string | null
  accountUserId?: string | null
  usageSurface?: string | null
}): Promise<GenerateReplyResult> {
  const {
    userMessage,
    history,
    systemPrompt,
    llmModel,
    apiKey: apiKeyFromCaller,
    accountUserId,
    usageSurface,
  } = options

  const apiKey = apiKeyFromCaller?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: false,
      error:
        'Gemini API key is missing. Add it in Config Agent (/ai-agents/config), or set GOOGLE_API_KEY in .env.',
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
    const usage = usageFromGeminiResponse(response, userMessage, text)
    recordLlmUsage({
      accountUserId,
      llmModel: modelName,
      usageSurface,
      inputUnits: usage.input,
      outputUnits: usage.output,
    })

    return { ok: true, text }
  } catch (err: unknown) {
    return mapGeminiError(err, llmModel)
  }
}

/**
 * One Gemini turn that may request function calls. Does not execute tools.
 * Caller decides read auto-run vs write propose/confirm.
 */
export async function generateReplyWithTools(options: {
  userMessage: string
  history: Message[]
  systemPrompt?: string | null
  tools: ToolDeclaration[]
  llmModel?: string | null
  apiKey?: string | null
  accountUserId?: string | null
  usageSurface?: string | null
}): Promise<GenerateReplyWithToolsResult> {
  const {
    userMessage,
    history,
    systemPrompt,
    tools,
    llmModel,
    apiKey: apiKeyFromCaller,
    accountUserId,
    usageSurface,
  } = options

  const apiKey = apiKeyFromCaller?.trim() || process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    return {
      ok: false,
      error:
        'Gemini API key is missing. Add it in Config Agent (/ai-agents/config), or set GOOGLE_API_KEY in .env.',
      code: 'NO_API_KEY',
    }
  }

  if (tools.length === 0) {
    const plain = await generateReply({
      userMessage,
      history,
      systemPrompt,
      llmModel,
      apiKey,
      accountUserId,
      usageSurface,
    })
    if (!plain.ok) {
      return {
        ok: false,
        error: plain.error,
        code: plain.code,
      }
    }
    return { ok: true, text: plain.text, requestedTools: [] }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = llmModel || MODEL_FALLBACK
    const declarations = toFunctionDeclarations(tools)
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
      tools: [{ functionDeclarations: declarations }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
        },
      },
    })

    const chatHistory = history
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }))

    const chat = model.startChat({ history: chatHistory })
    const result = await chat.sendMessage(userMessage)
    const response = await result.response
    const usage = usageFromGeminiResponse(response, userMessage, '')
    recordLlmUsage({
      accountUserId,
      llmModel: modelName,
      usageSurface,
      inputUnits: usage.input,
      outputUnits: usage.output,
    })
    const functionCalls = response.functionCalls?.() ?? []

    const requestedTools: RequestedToolCall[] = functionCalls.map((call) => ({
      name: call.name,
      args: (call.args || {}) as Record<string, unknown>,
    }))

    let text = ''
    try {
      text = response.text()
    } catch {
      text = ''
    }

    if (!text && requestedTools.length > 0) {
      text =
        requestedTools.length === 1
          ? `I need to run \`${requestedTools[0].name}\` to continue.`
          : `I need to run ${requestedTools.length} partner tools to continue.`
    }

    return { ok: true, text, requestedTools }
  } catch (err: unknown) {
    const mapped = mapGeminiError(err, llmModel)
    return {
      ok: false,
      error: mapped.ok ? 'Gemini request failed.' : mapped.error,
      code: mapped.ok ? 'UNKNOWN' : mapped.code,
    }
  }
}

/** Continue after tool results have been gathered (second Gemini turn). */
export async function summarizeToolResults(options: {
  userMessage: string
  history: Message[]
  systemPrompt?: string | null
  toolResults: Array<{ name: string; result: unknown }>
  llmModel?: string | null
  apiKey?: string | null
  accountUserId?: string | null
  usageSurface?: string | null
}): Promise<GenerateReplyResult> {
  const lines = options.toolResults.map((tr) => {
    const payload =
      typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result, null, 2)
    return `Tool ${tr.name} result:\n${payload}`
  })

  return generateReply({
    userMessage: [
      `Original user request: ${options.userMessage}`,
      '',
      'Partner tool results (already executed):',
      ...lines,
      '',
      'Summarize the outcome for the user clearly and concisely.',
    ].join('\n'),
    history: options.history,
    systemPrompt: options.systemPrompt,
    llmModel: options.llmModel,
    apiKey: options.apiKey,
    accountUserId: options.accountUserId,
    usageSurface: options.usageSurface,
  })
}
