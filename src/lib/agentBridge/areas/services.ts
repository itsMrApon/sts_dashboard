import 'server-only'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { getBusinessServices, saveServiceConfig, SERVICE_KIND } from '@/lib/services/serviceConfig'
import { getWebsiteConnection } from '@/lib/embed/websiteConnection'
import { PAID_ACCESS_ERROR, userHasPaidAccess } from '@/lib/billing/paidAccess'
import { AgentInputError, type AgentTool } from '../types'

const NO_BUSINESS = 'This account has no business set up yet. Finish onboarding in sts-ai first.'
const SWITCHABLE = ['chat', 'voice', 'form'] as const
type Switchable = (typeof SWITCHABLE)[number]

/**
 * Services: the website services (Chat AI, Voice AI, Form, Tour) the creator's site uses through
 * @sts-ai/sdk. The agent can see them and switch Chat, Voice or Form on or off; how each one
 * behaves is its assistant's job (AI Agents) and how it looks is the creator's own site design.
 */
export const SERVICE_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'list_services',
    area: 'services',
    title: 'Website services',
    description:
      'The creator’s website services (Chat AI, Voice AI, Form, Tour): which are on, the assistant that runs each, the chat greeting and suggestions, the form’s questions, and whether a website is connected (and its address). Their site uses these through @sts-ai/sdk with its own design.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(ctx) {
      const business = await getCreatorBusiness(ctx.userId)
      if (!business) throw new Error(NO_BUSINESS)
      const [services, website, tours] = await Promise.all([
        getBusinessServices(business.workspaceId),
        getWebsiteConnection(business.roomName),
        prismaClient.voiceWizard.findMany({
          where: { userId: business.userId },
          select: { slug: true, name: true, isPublished: true },
          take: 10,
        }),
      ])
      const result = {
        website: { connected: website.connected, address: website.origin },
        chat: {
          on: services.chat.enabled,
          assistant: services.chat.agent?.name ?? null,
          greeting: services.chat.config.greeting,
          suggestions: services.chat.config.suggestions,
        },
        voice: { on: services.speak.enabled, assistant: services.speak.agent?.name ?? null },
        form: {
          on: services.form.enabled,
          assistant: services.form.agent?.name ?? null,
          questions: services.form.config.fields?.map((field) => ({ id: field.id, label: field.label, type: field.type, required: field.required })) ?? [],
        },
        tour: { assistant: services.tour.agent?.name ?? null, tours: tours.map((t) => ({ slug: t.slug, name: t.name, live: t.isPublished })) },
      }
      return { text: JSON.stringify(result, null, 2), structured: result }
    },
  },
  {
    kind: 'write',
    policy: 'direct',
    name: 'set_service_on',
    area: 'services',
    title: 'Turn a website service on or off',
    description:
      'Switch Chat AI (chat), Voice AI (voice) or the Form (form) on or off for the creator’s website. Going live needs an assistant for that service (AI Agents), a connected website and a paid plan; the error says which is missing. Applied at once and logged.',
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
      const service = input.service as Switchable
      if (!SWITCHABLE.includes(service)) throw new AgentInputError('"service" must be chat, voice or form.')
      if (typeof input.on !== 'boolean') throw new AgentInputError('"on" must be true or false.')
      const label = { chat: 'Chat AI', voice: 'Voice AI', form: 'Form' }[service]
      return { title: input.on ? 'Turn on' : 'Turn off', detail: label, display: { service: label, on: input.on }, payload: { service, on: input.on } }
    },
    async apply(ctx, payload) {
      const service = payload.service as Switchable
      const on = payload.on === true
      const business = await getCreatorBusiness(ctx.userId)
      if (!business) throw new Error(NO_BUSINESS)
      const services = await getBusinessServices(business.workspaceId)
      const slot = service === 'chat' ? services.chat : service === 'voice' ? services.speak : services.form
      if (on) {
        if (!(await userHasPaidAccess(business.userId))) throw new Error(PAID_ACCESS_ERROR)
        if (!slot.agent) throw new Error('This service has no assistant yet. Pick one in sts-ai → AI Agents.')
        if (!slot.enabled && !(await getWebsiteConnection(business.roomName)).connected) {
          throw new Error('Connect the website first: run `npx @sts-ai/cli init` in the website folder.')
        }
      }
      // Only the switch changes; the stored looks (and linked assistant) stay as they are.
      const kind = SERVICE_KIND[service]
      const row = await prismaClient.serviceConfig.findUnique({
        where: { workspaceId_kind: { workspaceId: business.workspaceId, kind } },
        select: { config: true },
      })
      const stored = row?.config && typeof row.config === 'object' && !Array.isArray(row.config) ? { ...(row.config as Record<string, unknown>) } : {}
      delete stored.agentId
      await saveServiceConfig(business.workspaceId, kind, on, stored as Prisma.InputJsonObject)
      revalidatePath('/services', 'layout')
      return { service, on }
    },
  },
]
