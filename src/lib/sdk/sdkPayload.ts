import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import type { CreatorBusiness } from '@/lib/business/creatorBusiness'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { accentHex } from '@/lib/services/types'

/** What the SDK learns at session start: business basics + only the services that are on. */
export async function buildSdkSessionPayload(business: CreatorBusiness) {
  const [services, agent, wizards] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.liveKitAgent.findUnique({
      where: { id: business.agentId },
      select: { name: true, firstMessage: true, language: true },
    }),
    prismaClient.voiceWizard.findMany({
      where: { userId: business.userId, webinarId: null, isPublished: true },
      orderBy: { updatedAt: 'desc' },
      select: { slug: true, name: true, language: true },
    }),
  ])

  return {
    business: { name: business.name, description: business.description, aiName: agent?.name ?? null },
    services: {
      chat: services.chat.enabled
        ? {
            ...services.chat.config,
            assistantName: services.chat.config.assistantName || agent?.name || business.name,
            accent: accentHex(services.chat.config.accent),
          }
        : null,
      speak: services.speak.enabled
        ? {
            ...services.speak.config,
            firstMessage: agent?.firstMessage ?? null,
            language: agent?.language === 'bn' ? 'bn' : 'en',
          }
        : null,
      form: services.form.enabled
        ? {
            title: services.form.config.title,
            description: services.form.config.description,
            fields: services.form.config.fields,
            consentText: services.form.config.consentText,
            submitLabel: services.form.config.submitLabel,
            successMessage: services.form.config.successMessage,
            accent: accentHex(services.form.config.accent),
            theme: services.form.config.theme,
            redirectUrl: services.form.config.redirectUrl || null,
          }
        : null,
      wizards,
    },
  }
}
