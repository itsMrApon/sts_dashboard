import 'server-only'
import { WebServiceKind, type Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import {
  sanitizeChatConfig,
  sanitizeFormConfig,
  sanitizeSpeakConfig,
  type ChatServiceConfig,
  type FormServiceConfig,
  type ServiceState,
  type SpeakServiceConfig,
} from '@/lib/services/types'

export type BusinessServices = {
  chat: ServiceState<ChatServiceConfig>
  speak: ServiceState<SpeakServiceConfig>
  form: ServiceState<FormServiceConfig>
}

/** All service configs for a business, with defaults for ones never saved. */
export async function getBusinessServices(workspaceId: string): Promise<BusinessServices> {
  const rows = await prismaClient.serviceConfig.findMany({
    where: { workspaceId },
    select: { kind: true, enabled: true, config: true },
  })
  const byKind = new Map(rows.map((row) => [row.kind, row]))
  const chat = byKind.get(WebServiceKind.CHAT)
  const speak = byKind.get(WebServiceKind.SPEAK)
  const form = byKind.get(WebServiceKind.FORM)
  return {
    chat: { enabled: chat?.enabled ?? false, config: sanitizeChatConfig(chat?.config) },
    speak: { enabled: speak?.enabled ?? false, config: sanitizeSpeakConfig(speak?.config) },
    form: { enabled: form?.enabled ?? false, config: sanitizeFormConfig(form?.config) },
  }
}

export async function saveServiceConfig(
  workspaceId: string,
  kind: WebServiceKind,
  enabled: boolean,
  config: Prisma.InputJsonObject,
) {
  await prismaClient.serviceConfig.upsert({
    where: { workspaceId_kind: { workspaceId, kind } },
    create: { workspaceId, kind, enabled, config },
    update: { enabled, config },
  })
}
