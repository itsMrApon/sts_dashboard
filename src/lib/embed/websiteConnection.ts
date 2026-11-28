import 'server-only'
import { cache } from 'react'
import { prismaClient } from '@/lib/prismaClient'
import { connectionFromOrigins, type WebsiteConnection } from './websiteConnectionShared'

/**
 * The creator's website connection: an enabled embed config with at least one allowed origin.
 * One connection covers every service, so it is checked once, the first time a service goes live.
 * Localhost alone still counts as connected (for testing) but is flagged `localOnly`.
 */
export const getWebsiteConnection = cache(async (roomName: string): Promise<WebsiteConnection> => {
  const config = await prismaClient.roomEmbedConfig.findUnique({
    where: { roomName },
    select: { enabled: true, allowedOrigins: true },
  })
  return connectionFromOrigins(config?.enabled ? config.allowedOrigins : [])
})
