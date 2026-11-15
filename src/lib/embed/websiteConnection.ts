import 'server-only'
import { cache } from 'react'
import { prismaClient } from '@/lib/prismaClient'
import type { WebsiteConnection } from './websiteConnectionShared'

/**
 * The creator's website connection: an enabled embed config with at least one allowed origin.
 * One connection covers every service, so it is checked once, the first time a service goes live.
 */
export const getWebsiteConnection = cache(async (roomName: string): Promise<WebsiteConnection> => {
  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
    select: { enabled: true, allowedOrigins: true },
  })
  const origin = config?.enabled ? (config.allowedOrigins[0] ?? null) : null
  return { connected: origin !== null, origin }
})
