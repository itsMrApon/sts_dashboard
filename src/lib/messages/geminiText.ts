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
/**
 * Tried in order after the pinned model when it is missing for the key's project (new projects
 * lose access to older pinned models) or overloaded: Google's always-current Flash alias, then
 * the lighter Flash-Lite, which is usually far less loaded during demand spikes.
 */
const MODEL_FALLBACKS = ['gemini-flash-latest', 'gemini-flash-lite-latest']
/** One short wait-and-retry per model on "high demand" (503/500) before moving on. */
const BUSY_RETRY_MS = 1200
/** Per call. During demand spikes Gemini can hang for minutes; a hung call counts as busy. */
const GEMINI_TIMEOUT_MS = 30_000

/** Same wording as missingKeyMessage('google') in lib/credentials/providerKeys. */
export const GEMINI_KEY_MISSING_MESSAGE = 'Add your Gemini API key in AI Agents → Config.'

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

/** HTTP status from the SDK's fetch error ("[404 Not Found] …" in the message on older versions). */
function errorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status
  if (typeof status === 'number') return status
  const match = /\[(\d{3})[^\]]*\]/.exec(err instanceof Error ? err.message : String(err))
  return match ? Number(match[1]) : null
}

/** Google is overloaded right now ("high demand"): worth a short wait and a retry. */
function isBusy(err: unknown): boolean {
  const status = errorStatus(err)
  const message = err instanceof Error ? err.message : String(err)
  return status === 500 || status === 503 || /overloaded|high demand|aborted|timed? ?out/i.test(message)
}

/** Missing for this key's project, or busy: worth trying the next model. */
function worthTryingNextModel(err: unknown): boolean {
  const status = errorStatus(err)
  const message = err instanceof Error ? err.message : String(err)
  return isBusy(err) || status === 404 || /not found|is not supported for/i.test(message)
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Turns a Gemini failure into a message the creator can act on. Checked by status first: every
 * Gemini error URL contains "models/", so matching on text alone called them all "unavailable".
 */
function mapGeminiError(err: unknown, llmModel?: string | null): GenerateReplyResult {
  const message = err instanceof Error ? err.message : String(err)
  const status = errorStatus(err)

  if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return { ok: false, error: 'Gemini API key is invalid or revoked. Update it in AI Agents → Config.', code: 'INVALID_API_KEY' }
  }
  if (status === 429 || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
    return { ok: false, error: 'Gemini quota reached for this key. Wait a minute and try again.', code: 'QUOTA_EXCEEDED' }
  }
  if (/location is not supported/i.test(message)) {
    return { ok: false, error: 'Gemini isn’t available in this key’s region.', code: 'MODEL_ERROR' }
  }
  if (status === 403 || message.includes('PERMISSION_DENIED')) {
    return { ok: false, error: 'This key isn’t allowed to use Gemini. Create the key in Google AI Studio and try again.', code: 'INVALID_API_KEY' }
  }
  if (status === 404 || /not found|is not supported for/i.test(message)) {
    return { ok: false, error: `Model "${llmModel || MODEL_FALLBACK}" is unavailable for this key.`, code: 'MODEL_ERROR' }
  }
  if (isBusy(err)) {
    return { ok: false, error: 'Google reports high demand on Gemini right now. Try again in a minute.', code: 'UNKNOWN' }
  }
  return { ok: false, error: 'Gemini request failed. Please try again.', code: 'UNKNOWN' }
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

  // Creators bring their own key; the server's GOOGLE_API_KEY is never used for their traffic.
  const apiKey = apiKeyFromCaller?.trim()
  if (!apiKey) {
    return { ok: false, error: GEMINI_KEY_MISSING_MESSAGE, code: 'NO_API_KEY' }
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const pinned = llmModel || MODEL_FALLBACK
  const candidates = [...new Set([pinned, ...MODEL_FALLBACKS])]
  let lastError: unknown = null
  const attempts = candidates.flatMap((modelName) => [
    { modelName, retry: false },
    { modelName, retry: true },
  ])
  for (const { modelName, retry } of attempts) {
    // The retry on the same model only runs after a busy error, after a short wait.
    if (retry) {
      if (!isBusy(lastError)) continue
      await wait(BUSY_RETRY_MS)
    }
    try {
      const model = genAI.getGenerativeModel(
        {
          model: modelName,
          ...(systemPrompt
            ? {
                systemInstruction: {
                  role: 'system',
                  parts: [{ text: systemPrompt }],
                },
              }
            : {}),
        },
        { timeout: GEMINI_TIMEOUT_MS },
      )

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
      lastError = err
      // The real reason per attempt, for the server log (the key is never in this message).
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[gemini]', errorStatus(err) ?? '-', modelName, retry ? '(retry)' : '', message.slice(0, 240))
      if (!worthTryingNextModel(err)) break
    }
  }
  return mapGeminiError(lastError, llmModel)
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

  // Creators bring their own key; the server's GOOGLE_API_KEY is never used for their traffic.
  const apiKey = apiKeyFromCaller?.trim()
  if (!apiKey) {
    return { ok: false, error: GEMINI_KEY_MISSING_MESSAGE, code: 'NO_API_KEY' }
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
    }, { timeout: GEMINI_TIMEOUT_MS })

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
