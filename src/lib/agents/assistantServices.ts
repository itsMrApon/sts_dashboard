import type { ChatServiceConfig, FormServiceConfig, SpeakServiceConfig } from '@/lib/services/types'

/**
 * Each /ai-agents assistant is made for one website service. The assistant holds the prompt and
 * the service's behaviour (greeting, questions, call length…); /services keeps only the looks,
 * the on/off switch, share links and website code.
 */
export const ASSISTANT_SERVICES = ['chat', 'voice', 'form', 'tour'] as const
export type AssistantService = (typeof ASSISTANT_SERVICES)[number]

export const ASSISTANT_SERVICE_META: Record<
  AssistantService,
  { label: string; noun: string; description: string; servicePath: string; kind: 'CHAT' | 'SPEAK' | 'FORM' | 'TOUR' }
> = {
  chat: {
    label: 'Chat AI',
    noun: 'chat assistant',
    description: 'Answers visitors in the chat box, in its own words and style.',
    servicePath: '/services/chat',
    kind: 'CHAT',
  },
  voice: {
    label: 'Voice AI',
    noun: 'voice assistant',
    description: 'Talks to callers in real time: greeting, pace and call length.',
    servicePath: '/services/speak',
    kind: 'SPEAK',
  },
  form: {
    label: 'Form',
    noun: 'form assistant',
    description: 'Builds and runs your lead form, one question at a time.',
    servicePath: '/services/form',
    kind: 'FORM',
  },
  tour: {
    label: 'Tour',
    noun: 'tour guide',
    description: 'Narrates the guided tour of your business, step by step.',
    servicePath: '/services/wizard',
    kind: 'TOUR',
  },
}

export function isAssistantService(value: unknown): value is AssistantService {
  return typeof value === 'string' && (ASSISTANT_SERVICES as readonly string[]).includes(value)
}

/** An assistant may run a service it was made for. Classic assistants (no service) may run any. */
export function canRunService(agentService: string | null | undefined, service: AssistantService): boolean {
  return !agentService || agentService === service
}

/** Settings that stay on the service in /services (how it looks). Everything else is behaviour. */
export const LOOK_KEYS = {
  chat: ['accent'] satisfies (keyof ChatServiceConfig)[],
  voice: ['orbTheme', 'orbShape', 'callButtonLabel'] satisfies (keyof SpeakServiceConfig)[],
  form: ['accent', 'theme'] satisfies (keyof FormServiceConfig)[],
} as const

/** Splits a full service config into its look part and its behaviour part. */
export function splitServiceConfig<T extends object>(config: T, lookKeys: readonly string[]) {
  const look: Record<string, unknown> = {}
  const behaviour: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (lookKeys.includes(key)) look[key] = value
    else behaviour[key] = value
  }
  return { look: look as Partial<T>, behaviour: behaviour as Partial<T> }
}
