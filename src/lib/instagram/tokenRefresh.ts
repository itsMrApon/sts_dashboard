import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { refreshLongLivedToken } from '@/lib/instagram/graph'

const REFRESH_WITHIN_MS = 10 * 24 * 60 * 60 * 1000

/**
 * Refreshes Instagram logins that expire within 10 days (they last 60). A login that can't be
 * refreshed is left as is: the creator sees "reconnect" when it finally expires.
 */
export async function refreshExpiringInstagramTokens() {
  const soon = new Date(Date.now() + REFRESH_WITHIN_MS)
  const rows = await prismaClient.instagramConnection.findMany({ where: { tokenExpiresAt: { lte: soon } } })
  let refreshed = 0
  const failed: string[] = []
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
      console.warn('[instagram] token refresh failed; the creator must reconnect', row.userId, String(error))
      failed.push(row.userId)
    }
  }
  return { checked: rows.length, refreshed, failed }
}
