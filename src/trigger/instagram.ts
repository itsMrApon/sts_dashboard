import { logger, schedules } from '@trigger.dev/sdk'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { processInstagramQueue } from '@/lib/instagram/campaigns'
import { refreshLongLivedToken } from '@/lib/instagram/graph'

/** Every 5 minutes: DMs that failed for a moment, or waited for the hourly cap, go out. */
export const instagramQueue = schedules.task({
  id: 'instagram-queue',
  cron: '*/5 * * * *',
  run: async () => processInstagramQueue(100),
})

/** Daily: refresh tokens that expire within 10 days (Instagram tokens last 60 days). */
export const instagramTokenRefresh = schedules.task({
  id: 'instagram-token-refresh',
  cron: '0 4 * * *',
  run: async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
    const rows = await prismaClient.instagramConnection.findMany({ where: { tokenExpiresAt: { lte: soon } } })
    let refreshed = 0
    for (const row of rows) {
      const token = decryptToken(row.accessTokenEnc)
      if (!token) continue
      try {
        const next = await refreshLongLivedToken(token)
        await prismaClient.instagramConnection.update({
          where: { id: row.id },
          data: { accessTokenEnc: encryptToken(next.accessToken), tokenExpiresAt: new Date(Date.now() + next.expiresIn * 1000) },
        })
        refreshed += 1
      } catch (error) {
        logger.warn('Instagram token refresh failed; the creator must reconnect', { userId: row.userId, error: String(error) })
      }
    }
    return { checked: rows.length, refreshed }
  },
})
