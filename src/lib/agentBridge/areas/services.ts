import 'server-only'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness, type CreatorBusiness } from '@/lib/business/creatorBusiness'
import {
  getBusinessServices,
  saveServiceConfig,
  SERVICE_KIND,
  linkedAgentId,
  type BusinessServices,
  type ServiceAssistant,
} from '@/lib/services/serviceConfig'
import { getWebsiteConnection } from '@/lib/embed/websiteConnection'
import { PAID_ACCESS_ERROR, userCanGoLive } from '@/lib/billing/paidAccess'
import { myAssistantsWhere } from '@/lib/agents/agentAccess'
import { ASSISTANT_SERVICES, canRunService, isAssistantService, type AssistantService } from '@/lib/agents/assistantServices'
import { isAgentLanguage } from '@/lib/agents/engineOptions'
import {
  ASSISTANT_LIMITS,
  createAssistantForOwner,
  linkAssistantForOwner,
  saveAssistantBehaviourForOwner,
  updateAssistantForOwner,
} from '@/lib/agents/assistantWrites'
import { SERVICE_LIMITS, sanitizeFormConfig } from '@/lib/services/types'
import { getOrCreateBusinessWizard } from '@/lib/wizard/wizardRepo'
import { pregenerateClips, pruneStaleClips } from '@/lib/wizard/wizardAudio'
import { WIZARD_LIMITS, sanitizeSteps } from '@/lib/wizard/types'
import { AgentInputError, str, type AgentTool } from '../types'

const NO_BUSINESS = 'This account has no business set up yet. Finish onboarding in sts-ai first.'
const SWITCHABLE = ['chat', 'voice', 'form', 'tour'] as const
type Switchable = (typeof SWITCHABLE)[number]
const SERVICE_LABEL: Record<AssistantService, string> = { chat: 'Chat AI', voice: 'Voice AI', form: 'Form', tour: 'Tour' }
/** How much of a prompt list_assistants returns per assistant (the whole prompt is rarely needed). */
const PROMPT_PREVIEW = 6_000

async function requireBusiness(userId: string): Promise<CreatorBusiness> {
  const business = await getCreatorBusiness(userId)
  if (!business) throw new Error(NO_BUSINESS)
  return business
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function service(input: Record<string, unknown>, key = 'service'): AssistantService {
  const value = input[key]
  if (!isAssistantService(value)) throw new AgentInputError(`"${key}" must be one of ${ASSISTANT_SERVICES.join(', ')}.`)
  return value
}

/** An optional string field: undefined when absent, so "leave it as it is" differs from "clear it". */
function optional(input: Record<string, unknown>, key: string, max: number): string | undefined {
  if (input[key] === undefined) return undefined
  if (typeof input[key] !== 'string') throw new AgentInputError(`"${key}" must be a string.`)
  const value = input[key] as string
  if (value.length > max) throw new AgentInputError(`"${key}" is longer than ${max} characters.`)
  return value
}

/** The creator's assistant (theirs, or a classic one they may use), with its service settings. */
async function ownAssistant(userId: string, assistantId: string) {
  const agent = await prismaClient.liveKitAgent.findFirst({
    where: { AND: [{ id: assistantId }, myAssistantsWhere(userId)] },
    select: { id: true, name: true, service: true, systemPrompt: true, firstMessage: true, language: true, serviceSettings: true },
  })
  if (!agent) throw new AgentInputError('No assistant with that id. Call list_assistants for the ids.')
  return agent
}

/** The assistant running a service right now, or a clear error saying how to get one. */
async function runningAssistant<K extends 'chat' | 'form'>(
  business: CreatorBusiness,
  which: K,
): Promise<{ agent: ServiceAssistant; config: BusinessServices[K]['config'] }> {
  const services = await getBusinessServices(business.workspaceId)
  const agent = services[which].agent
  if (!agent) {
    throw new AgentInputError(
      `${SERVICE_LABEL[which]} has no assistant yet. Create one with create_assistant (service "${which}") or pick one with set_service_assistant.`,
    )
  }
  return { agent, config: services[which].config }
}

/**
 * Services: the website services (Chat AI, Voice AI, Form, Tour) the creator's site uses through
 * @sts-ai/sdk, and the AI Agents assistants that run them. The agent can see all of it, switch
 * services on or off, and (with the creator's approval) create assistants, pick which one runs a
 * service, edit prompts, the chat greeting, the form's questions and the tour.
 */
export const SERVICE_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'list_services',
    area: 'services',
    title: 'Website services',
    description:
      'The creator’s website services (Chat AI, Voice AI, Form, Tour): which are on, the assistant (id and name) that runs each, the chat greeting and suggestions, the form’s questions, the business tour’s steps, and whether a website is connected (and its address). Their site uses these through @sts-ai/sdk with its own design. Use list_assistants for the prompts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(ctx) {
      const business = await requireBusiness(ctx.userId)
      const [services, website, tour, canGoLive] = await Promise.all([
        getBusinessServices(business.workspaceId),
        getWebsiteConnection(business.roomName),
        prismaClient.voiceWizard.findFirst({
          where: { userId: business.userId, webinarId: null },
          orderBy: { createdAt: 'asc' },
          select: { slug: true, name: true, guideName: true, isPublished: true, steps: true },
        }),
        userCanGoLive(business.userId),
      ])
      const assistant = (agent: { id: string; name: string } | null) => (agent ? { id: agent.id, name: agent.name } : null)
      const result = {
        website: {
          connected: website.connected,
          address: website.origin,
          localOnly: website.localOnly,
          ...(website.localOnly
            ? { note: 'Only localhost is allowed, so the live website is refused (ORIGIN_NOT_ALLOWED). The creator adds its address in sts-ai → Services → Connection.' }
            : {}),
        },
        canGoLive,
        chat: {
          on: services.chat.enabled,
          assistant: assistant(services.chat.agent),
          greeting: services.chat.config.greeting,
          suggestions: services.chat.config.suggestions,
        },
        voice: { on: services.speak.enabled, assistant: assistant(services.speak.agent) },
        form: {
          on: services.form.enabled,
          assistant: assistant(services.form.agent),
          title: services.form.config.title,
          questions:
            services.form.config.fields?.map((field) => ({
              id: field.id,
              label: field.label,
              type: field.type,
              required: field.required,
              options: field.options,
            })) ?? [],
        },
        tour: {
          on: Boolean(tour?.isPublished && services.tour.agent),
          assistant: assistant(services.tour.agent),
          slug: tour?.slug ?? null,
          name: tour?.name ?? null,
          guideName: tour?.guideName ?? null,
          steps: sanitizeSteps(tour?.steps),
        },
      }
      return { text: JSON.stringify(result, null, 2), structured: result }
    },
  },
  {
    kind: 'read',
    name: 'list_assistants',
    area: 'services',
    title: 'AI assistants',
    description:
      'The creator’s AI assistants (AI Agents): id, name, the service each is made for (chat, voice, form, tour; null = any), which services it runs now, language, first message and its prompt (instructions). Use the ids with set_service_assistant and update_assistant.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(ctx) {
      const business = await requireBusiness(ctx.userId)
      const [agents, rows] = await Promise.all([
        prismaClient.liveKitAgent.findMany({
          where: myAssistantsWhere(ctx.userId),
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, service: true, language: true, firstMessage: true, systemPrompt: true },
        }),
        prismaClient.serviceConfig.findMany({ where: { workspaceId: business.workspaceId }, select: { kind: true, config: true } }),
      ])
      const assistants = agents.map((agent) => {
        const runs = ASSISTANT_SERVICES.filter(
          (svc) =>
            linkedAgentId(rows.find((row) => row.kind === SERVICE_KIND[svc])?.config) === agent.id && canRunService(agent.service, svc),
        )
        const prompt = agent.systemPrompt ?? ''
        return {
          id: agent.id,
          name: agent.name,
          madeFor: isAssistantService(agent.service) ? agent.service : null,
          runs,
          isBusinessAddress: agent.id === business.agentId,
          language: agent.language,
          firstMessage: agent.firstMessage ?? '',
          prompt: prompt.length > PROMPT_PREVIEW ? `${prompt.slice(0, PROMPT_PREVIEW)}\n…(${prompt.length - PROMPT_PREVIEW} more characters)` : prompt,
        }
      })
      return {
        text: assistants.length ? JSON.stringify(assistants, null, 2) : 'No assistants yet. Create one with create_assistant.',
        structured: { assistants },
      }
    },
  },
  {
    kind: 'write',
    policy: 'direct',
    name: 'set_service_on',
    area: 'services',
    title: 'Turn a website service on or off',
    description:
      'Switch Chat AI (chat), Voice AI (voice), the Form (form) or the business Tour (tour) on or off for the creator’s website. Going live needs an assistant for that service, a connected website, and either the creator’s own Gemini key (free) or a paid plan; the error says which is missing. Applied at once and logged.',
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', enum: [...SWITCHABLE] },
        on: { type: 'boolean' },
      },
      required: ['service', 'on'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const which = input.service as Switchable
      if (!SWITCHABLE.includes(which)) throw new AgentInputError('"service" must be chat, voice, form or tour.')
      if (typeof input.on !== 'boolean') throw new AgentInputError('"on" must be true or false.')
      const label = SERVICE_LABEL[which]
      return { title: input.on ? 'Turn on' : 'Turn off', detail: label, display: { service: label, on: input.on }, payload: { service: which, on: input.on } }
    },
    async apply(ctx, payload) {
      const which = payload.service as Switchable
      const on = payload.on === true
      const business = await requireBusiness(ctx.userId)
      const services = await getBusinessServices(business.workspaceId)
      const agent = which === 'chat' ? services.chat.agent : which === 'voice' ? services.speak.agent : which === 'form' ? services.form.agent : services.tour.agent

      if (which === 'tour') {
        const tour = await getOrCreateBusinessWizard(business)
        if (on) {
          if (!(await userCanGoLive(business.userId))) throw new Error(PAID_ACCESS_ERROR)
          if (!agent) throw new Error('The Tour has no assistant yet. Create one with create_assistant (service "tour").')
          if (!tour.steps.length) throw new Error('The tour has no steps yet. Add them with update_tour.')
          if (!tour.isPublished && !(await getWebsiteConnection(business.roomName)).connected) {
            throw new Error('Connect the website first: run `npx @sts-ai/cli init` in the website folder.')
          }
        }
        // Pre-render narration so the first visitor gets instant audio (English / Cartesia only).
        const audio = on && tour.language === 'en' ? await pregenerateClips(tour.id, business.userId, tour.voice, tour.steps) : null
        await prismaClient.voiceWizard.update({
          where: { id: tour.id },
          data: { isPublished: on, publishedAt: on ? new Date() : null },
        })
        revalidatePath(`/wizard/${tour.slug}`)
        revalidatePath('/services/wizard')
        return {
          service: which,
          on,
          ...(audio?.missingKey ? { note: 'No Cartesia key: the tour plays, but narration is made on the first visit.' } : {}),
        }
      }

      if (on) {
        if (!(await userCanGoLive(business.userId))) throw new Error(PAID_ACCESS_ERROR)
        if (!agent) throw new Error(`${SERVICE_LABEL[which]} has no assistant yet. Create one with create_assistant or pick one with set_service_assistant.`)
        const enabled = which === 'chat' ? services.chat.enabled : which === 'voice' ? services.speak.enabled : services.form.enabled
        if (!enabled && !(await getWebsiteConnection(business.roomName)).connected) {
          throw new Error('Connect the website first: run `npx @sts-ai/cli init` in the website folder.')
        }
      }
      // Only the switch changes; the stored looks (and linked assistant) stay as they are.
      const kind = SERVICE_KIND[which]
      const row = await prismaClient.serviceConfig.findUnique({
        where: { workspaceId_kind: { workspaceId: business.workspaceId, kind } },
        select: { config: true },
      })
      const stored = { ...record(row?.config) }
      delete stored.agentId
      await saveServiceConfig(business.workspaceId, kind, on, stored as Prisma.InputJsonObject)
      revalidatePath('/services', 'layout')
      return { service: which, on }
    },
  },
  {
    kind: 'write',
    name: 'create_assistant',
    area: 'services',
    title: 'Create an AI assistant',
    description:
      'Create an AI assistant (AI Agents) made for one service: chat, voice, form or tour. Give it a name, its prompt (instructions; base it on get_business_brain) and a first message. With run_service true (the default) it also starts running that service, replacing the current assistant; false only links it when the service has none.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: ASSISTANT_LIMITS.name },
        service: { type: 'string', enum: [...ASSISTANT_SERVICES] },
        prompt: { type: 'string', maxLength: ASSISTANT_LIMITS.prompt, description: 'The assistant’s instructions. Keep Bangla exactly as written.' },
        first_message: { type: 'string', maxLength: ASSISTANT_LIMITS.firstMessage, description: 'What it says first (the chat greeting for chat assistants).' },
        language: { type: 'string', description: 'en or bn (default en).' },
        run_service: { type: 'boolean', description: 'Make it run the service now (default true).' },
      },
      required: ['name', 'service', 'prompt'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      await requireBusiness(ctx.userId)
      const name = str(input, 'name', { max: ASSISTANT_LIMITS.name, required: true })
      const svc = service(input)
      const prompt = str(input, 'prompt', { max: ASSISTANT_LIMITS.prompt, required: true })
      const firstMessage = str(input, 'first_message', { max: ASSISTANT_LIMITS.firstMessage })
      const language = input.language === undefined ? 'en' : input.language
      if (!isAgentLanguage(language)) throw new AgentInputError('"language" must be en or bn.')
      const runService = input.run_service !== false
      return {
        title: 'Create assistant',
        detail: `${name} · ${SERVICE_LABEL[svc]}`,
        display: { name, service: SERVICE_LABEL[svc], runsItNow: runService, language, firstMessage, prompt },
        payload: { name, service: svc, prompt, firstMessage, language, runService },
      }
    },
    async apply(ctx, payload) {
      const business = await requireBusiness(ctx.userId)
      const svc = payload.service as AssistantService
      const result = await createAssistantForOwner(
        { userId: ctx.userId, workspaceId: business.workspaceId },
        {
          name: String(payload.name),
          service: svc,
          systemPrompt: String(payload.prompt),
          firstMessage: String(payload.firstMessage ?? ''),
          language: String(payload.language ?? 'en'),
          // A chat assistant greets with its first message.
          behaviour: svc === 'chat' && payload.firstMessage ? { greeting: String(payload.firstMessage).slice(0, SERVICE_LIMITS.greeting) } : undefined,
          link: payload.runService === false ? 'if-free' : true,
        },
      )
      if (!result.ok) throw new Error(result.error)
      return { assistantId: result.id, runsService: result.linked ? svc : null }
    },
  },
  {
    kind: 'write',
    name: 'set_service_assistant',
    area: 'services',
    title: 'Pick the assistant that runs a service',
    description:
      'Choose which assistant runs a service (chat, voice, form or tour). assistant_id null removes it, which also turns that service off. The assistant must be made for that service (or be a classic one); see list_assistants.',
    inputSchema: {
      type: 'object',
      properties: {
        service: { type: 'string', enum: [...ASSISTANT_SERVICES] },
        assistant_id: { type: ['string', 'null'] },
      },
      required: ['service', 'assistant_id'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const business = await requireBusiness(ctx.userId)
      const svc = service(input)
      if (input.assistant_id === null) {
        return { title: 'Remove assistant', detail: SERVICE_LABEL[svc], display: { service: SERVICE_LABEL[svc], assistant: 'None (turns it off)' }, payload: { service: svc, assistantId: null } }
      }
      const id = str(input, 'assistant_id', { max: 64, required: true })
      const agent = await ownAssistant(ctx.userId, id)
      if (!canRunService(agent.service, svc)) {
        throw new AgentInputError(`${agent.name} is made for ${SERVICE_LABEL[agent.service as AssistantService] ?? 'another service'}, not ${SERVICE_LABEL[svc]}.`)
      }
      const current = await getBusinessServices(business.workspaceId)
      const now = svc === 'chat' ? current.chat.agent : svc === 'voice' ? current.speak.agent : svc === 'form' ? current.form.agent : current.tour.agent
      return {
        title: 'Run with',
        detail: `${SERVICE_LABEL[svc]} → ${agent.name}`,
        display: { service: SERVICE_LABEL[svc], before: now?.name ?? 'No assistant', after: agent.name },
        payload: { service: svc, assistantId: agent.id },
      }
    },
    async apply(ctx, payload) {
      const business = await requireBusiness(ctx.userId)
      const svc = payload.service as AssistantService
      const assistantId = typeof payload.assistantId === 'string' ? payload.assistantId : null
      const result = await linkAssistantForOwner({ userId: ctx.userId, workspaceId: business.workspaceId }, svc, assistantId)
      if (!result.ok) throw new Error(result.error)
      return { service: svc, assistantId }
    },
  },
  {
    kind: 'write',
    name: 'update_assistant',
    area: 'services',
    title: 'Edit an assistant',
    description:
      'Change an assistant’s prompt (its instructions), first message, name or language. Send only what changes; the full new prompt replaces the old one (read it with list_assistants first). Keep Bangla exactly as written.',
    inputSchema: {
      type: 'object',
      properties: {
        assistant_id: { type: 'string' },
        prompt: { type: 'string', maxLength: ASSISTANT_LIMITS.prompt },
        first_message: { type: 'string', maxLength: ASSISTANT_LIMITS.firstMessage },
        name: { type: 'string', maxLength: ASSISTANT_LIMITS.name },
        language: { type: 'string', description: 'en or bn.' },
      },
      required: ['assistant_id'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const agent = await ownAssistant(ctx.userId, str(input, 'assistant_id', { max: 64, required: true }))
      const prompt = optional(input, 'prompt', ASSISTANT_LIMITS.prompt)
      const firstMessage = optional(input, 'first_message', ASSISTANT_LIMITS.firstMessage)
      const name = optional(input, 'name', ASSISTANT_LIMITS.name)
      const language = optional(input, 'language', 8)
      if (prompt !== undefined && !prompt.trim()) throw new AgentInputError('"prompt" cannot be empty.')
      if (name !== undefined && !name.trim()) throw new AgentInputError('"name" cannot be empty.')
      if (language !== undefined && !isAgentLanguage(language)) throw new AgentInputError('"language" must be en or bn.')
      if ([prompt, firstMessage, name, language].every((value) => value === undefined)) {
        throw new AgentInputError('Send at least one of prompt, first_message, name or language.')
      }
      // The approval card shows before → after for the part that matters most.
      const display: Record<string, unknown> =
        prompt !== undefined
          ? { before: agent.systemPrompt ?? '', after: prompt }
          : firstMessage !== undefined && name === undefined && language === undefined
            ? { before: agent.firstMessage ?? '', after: firstMessage }
            : { name, firstMessage, language }
      return {
        title: prompt !== undefined ? 'Edit prompt' : 'Edit assistant',
        detail: agent.name,
        display: Object.fromEntries(Object.entries(display).filter(([, value]) => value !== undefined)),
        payload: { assistantId: agent.id, prompt, firstMessage, name, language },
      }
    },
    async apply(ctx, payload) {
      const text = (key: string) => (typeof payload[key] === 'string' ? (payload[key] as string) : undefined)
      const result = await updateAssistantForOwner(ctx.userId, String(payload.assistantId), {
        systemPrompt: text('prompt'),
        firstMessage: text('firstMessage'),
        name: text('name'),
        language: text('language'),
      })
      if (!result.ok) throw new Error(result.error)
      return { assistantId: payload.assistantId, updated: true }
    },
  },
  {
    kind: 'write',
    name: 'set_chat_greeting',
    area: 'services',
    title: 'Set the chat greeting and suggestions',
    description: `Change what Chat AI says first (greeting, up to ${SERVICE_LIMITS.greeting} characters) and the suggested questions under it (up to ${SERVICE_LIMITS.maxSuggestions}, ${SERVICE_LIMITS.suggestion} characters each). Send either or both; it is saved on the chat assistant.`,
    inputSchema: {
      type: 'object',
      properties: {
        greeting: { type: 'string', maxLength: SERVICE_LIMITS.greeting },
        suggestions: { type: 'array', items: { type: 'string', maxLength: SERVICE_LIMITS.suggestion }, maxItems: SERVICE_LIMITS.maxSuggestions },
      },
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const business = await requireBusiness(ctx.userId)
      const greeting = optional(input, 'greeting', SERVICE_LIMITS.greeting)
      let suggestions: string[] | undefined
      if (input.suggestions !== undefined) {
        if (!Array.isArray(input.suggestions) || input.suggestions.some((item) => typeof item !== 'string')) {
          throw new AgentInputError('"suggestions" must be a list of strings.')
        }
        if (input.suggestions.length > SERVICE_LIMITS.maxSuggestions) throw new AgentInputError(`At most ${SERVICE_LIMITS.maxSuggestions} suggestions.`)
        suggestions = (input.suggestions as string[]).map((item) => item.trim()).filter(Boolean)
        if (suggestions.some((item) => item.length > SERVICE_LIMITS.suggestion)) {
          throw new AgentInputError(`Each suggestion is at most ${SERVICE_LIMITS.suggestion} characters.`)
        }
      }
      if (greeting === undefined && suggestions === undefined) throw new AgentInputError('Send greeting, suggestions or both.')
      const { agent, config } = await runningAssistant(business, 'chat')
      return {
        title: 'Chat greeting',
        detail: agent.name,
        display: {
          ...(greeting !== undefined ? { before: config.greeting, after: greeting } : {}),
          ...(suggestions !== undefined ? { suggestions } : {}),
        },
        payload: { assistantId: agent.id, greeting, suggestions },
      }
    },
    async apply(ctx, payload) {
      const assistantId = String(payload.assistantId)
      const agent = await ownAssistant(ctx.userId, assistantId)
      const current = record(record(agent.serviceSettings).chat)
      const next = {
        ...current,
        ...(typeof payload.greeting === 'string' ? { greeting: payload.greeting } : {}),
        ...(Array.isArray(payload.suggestions) ? { suggestions: payload.suggestions } : {}),
      }
      const result = await saveAssistantBehaviourForOwner(ctx.userId, assistantId, 'chat', next)
      if (!result.ok) throw new Error(result.error)
      return { greeting: result.settings.greeting, suggestions: result.settings.suggestions }
    },
  },
  {
    kind: 'write',
    name: 'set_form_questions',
    area: 'services',
    title: 'Set the form’s questions',
    description: `Replace the website Form’s questions (up to ${SERVICE_LIMITS.maxFields}), and optionally its title, description and success message. Question types: text, textarea, email, phone, number, url, date, select (give options; multiple for several), yesno, rating (scale 5 or 10). Keep an existing question’s id to keep its answers lined up.`,
    inputSchema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          maxItems: SERVICE_LIMITS.maxFields,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string', maxLength: SERVICE_LIMITS.fieldLabel },
              type: { type: 'string', enum: ['text', 'textarea', 'email', 'phone', 'number', 'url', 'date', 'select', 'yesno', 'rating'] },
              required: { type: 'boolean' },
              options: { type: 'array', items: { type: 'string', maxLength: SERVICE_LIMITS.option }, maxItems: SERVICE_LIMITS.maxOptions },
              multiple: { type: 'boolean' },
              scale: { type: 'integer', enum: [5, 10] },
              placeholder: { type: 'string', maxLength: SERVICE_LIMITS.placeholder },
              helpText: { type: 'string', maxLength: SERVICE_LIMITS.helpText },
            },
            required: ['label', 'type'],
            additionalProperties: false,
          },
        },
        title: { type: 'string', maxLength: SERVICE_LIMITS.formTitle },
        description: { type: 'string', maxLength: SERVICE_LIMITS.formDescription },
        success_message: { type: 'string', maxLength: SERVICE_LIMITS.successMessage },
      },
      required: ['questions'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      const business = await requireBusiness(ctx.userId)
      if (!Array.isArray(input.questions) || !input.questions.length) throw new AgentInputError('"questions" must be a non-empty list.')
      const title = optional(input, 'title', SERVICE_LIMITS.formTitle)
      const description = optional(input, 'description', SERVICE_LIMITS.formDescription)
      const successMessage = optional(input, 'success_message', SERVICE_LIMITS.successMessage)
      const { agent, config } = await runningAssistant(business, 'form')
      // Cleaned exactly as the Form editor would; what the creator approves is what gets saved.
      const cleaned = sanitizeFormConfig({
        ...config,
        fields: input.questions,
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(successMessage !== undefined ? { successMessage } : {}),
      })
      if (!cleaned.fields.length) throw new AgentInputError('None of the questions were usable: each needs a label and a known type.')
      return {
        title: 'Form questions',
        detail: `${agent.name} · ${cleaned.fields.length} question${cleaned.fields.length === 1 ? '' : 's'}`,
        display: {
          ...(title !== undefined ? { title } : {}),
          questions: cleaned.fields.map((field) => `${field.label} (${field.type}${field.required ? ', required' : ''}${field.options.length ? `: ${field.options.join(' / ')}` : ''})`),
        },
        payload: {
          assistantId: agent.id,
          fields: cleaned.fields,
          title: title !== undefined ? cleaned.title : undefined,
          description: description !== undefined ? cleaned.description : undefined,
          successMessage: successMessage !== undefined ? cleaned.successMessage : undefined,
        },
      }
    },
    async apply(ctx, payload) {
      const assistantId = String(payload.assistantId)
      const agent = await ownAssistant(ctx.userId, assistantId)
      const current = record(record(agent.serviceSettings).form)
      const next = {
        ...current,
        fields: payload.fields,
        ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
        ...(typeof payload.description === 'string' ? { description: payload.description } : {}),
        ...(typeof payload.successMessage === 'string' ? { successMessage: payload.successMessage } : {}),
      }
      const result = await saveAssistantBehaviourForOwner(ctx.userId, assistantId, 'form', next)
      if (!result.ok) throw new Error(result.error)
      return { questions: Array.isArray(result.settings.fields) ? result.settings.fields.length : 0 }
    },
  },
  {
    kind: 'write',
    name: 'update_tour',
    area: 'services',
    title: 'Edit the business tour',
    description: `Replace the business Tour’s steps: the voice guide that walks visitors through sections of the creator’s website. Up to ${WIZARD_LIMITS.maxSteps} steps; each has a heading, body, narration (what the guide says; defaults to heading + body), an optional call to action (cta_label + https cta_url) and target: the data-sts-step value of the website section to scroll to. Optionally rename the tour or its guide. Turn it on with set_service_on (service "tour").`,
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: WIZARD_LIMITS.maxSteps,
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', maxLength: WIZARD_LIMITS.heading },
              body: { type: 'string', maxLength: WIZARD_LIMITS.body },
              narration: { type: 'string', maxLength: WIZARD_LIMITS.narration },
              target: { type: 'string', maxLength: WIZARD_LIMITS.target, description: 'data-sts-step value of the page section, e.g. "pricing".' },
              cta_label: { type: 'string', maxLength: WIZARD_LIMITS.ctaLabel },
              cta_url: { type: 'string', maxLength: WIZARD_LIMITS.ctaUrl },
            },
            additionalProperties: false,
          },
        },
        name: { type: 'string', maxLength: WIZARD_LIMITS.name },
        guide_name: { type: 'string', maxLength: WIZARD_LIMITS.guideName, description: 'The guide’s name, e.g. "Nova".' },
      },
      required: ['steps'],
      additionalProperties: false,
    },
    async propose(ctx, input) {
      await requireBusiness(ctx.userId)
      if (!Array.isArray(input.steps)) throw new AgentInputError('"steps" must be a list.')
      const steps = sanitizeSteps(
        (input.steps as Record<string, unknown>[]).map((step) => ({
          heading: step?.heading,
          body: step?.body,
          narration: step?.narration,
          target: step?.target,
          ctaLabel: step?.cta_label,
          ctaUrl: step?.cta_url,
        })),
      )
      if (!steps.length) throw new AgentInputError('Each step needs a heading, body or narration.')
      const name = optional(input, 'name', WIZARD_LIMITS.name)?.trim()
      const guideName = optional(input, 'guide_name', WIZARD_LIMITS.guideName)?.trim()
      return {
        title: 'Tour steps',
        detail: `${steps.length} step${steps.length === 1 ? '' : 's'}`,
        display: {
          ...(name ? { name } : {}),
          ...(guideName ? { guide: guideName } : {}),
          steps: steps.map((step, i) => `${i + 1}. ${step.heading || step.narration.slice(0, 60)}${step.target ? ` → #${step.target}` : ''}`),
        },
        payload: { steps, name, guideName },
      }
    },
    async apply(ctx, payload) {
      const business = await requireBusiness(ctx.userId)
      const tour = await getOrCreateBusinessWizard(business)
      const steps = sanitizeSteps(payload.steps)
      if (!steps.length) throw new Error('No usable steps.')
      await prismaClient.voiceWizard.update({
        where: { id: tour.id },
        data: {
          steps,
          workspaceId: business.workspaceId,
          ...(typeof payload.name === 'string' && payload.name ? { name: payload.name } : {}),
          ...(typeof payload.guideName === 'string' && payload.guideName ? { guideName: payload.guideName } : {}),
        },
      })
      await pruneStaleClips(tour.id, tour.voice, steps)
      // A live tour gets its new narration ready now, so visitors don't wait on it.
      if (tour.isPublished && tour.language === 'en') await pregenerateClips(tour.id, business.userId, tour.voice, steps)
      revalidatePath(`/wizard/${tour.slug}`)
      revalidatePath('/services/wizard')
      return { slug: tour.slug, steps: steps.length, live: tour.isPublished }
    },
  },
]
