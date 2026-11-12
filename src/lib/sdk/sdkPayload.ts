import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import type { CreatorBusiness } from '@/lib/business/creatorBusiness'
import { getBusinessServices } from '@/lib/services/serviceConfig'

/** What the SDK learns at session start: business basics + only the services that are on. */
export async function buildSdkSessionPayload(business: CreatorBusiness) {
  const [services, agent, wizards] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.liveKitAgent.findUnique({
      where: { id: business.agentId },
      select: { name: true, firstMessage: true, language: true },
    }),
    prismaClient.voiceWizard.findMany({
      where: { userId: business.userId, isPublished: true },
      orderBy: { updatedAt: 'desc' },
      select: { slug: true, name: true, language: true },
    }),
  ])

  return {
    business: { name: business.name, description: business.description, aiName: agent?.name ?? null },
    services: {
      chat: services.chat.enabled ? services.chat.config : null,
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
          }
        : null,
      wizards,
    },
  }
}
