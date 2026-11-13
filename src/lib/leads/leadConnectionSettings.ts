import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { googleCalendarNeedsReconnect, resolveGoogleOAuthCredentials } from '@/lib/leads/googleCalendar'
import { resolveSerperApiKey } from '@/lib/leads/webResearch'
import { decryptToken } from '@/lib/messages/encrypt'

/** What the Lead settings panel (Fathom, Google Calendar, Serper) needs to render. */
export type LeadConnectionSettings = {
  fathomOk: boolean
  gcalOk: boolean
  gcalNeedsReconnect: boolean
  googleOAuthConfigured: boolean
  hasUserGoogleOAuth: boolean
  serperConfigured: boolean
  hasUserSerperKey: boolean
  calendarFilterMode: 'ALL' | 'KEYWORD'
  calendarKeyword: string
}

export async function loadLeadConnectionSettings(userId: string): Promise<LeadConnectionSettings> {
  const [connections, settings, googleOAuth, serperKey] = await Promise.all([
    prismaClient.callIntelConnection.findMany({
      where: { userId },
      select: { provider: true, status: true, metadata: true, credentials: true },
    }),
    prismaClient.callIntelSettings.findUnique({
      where: { userId },
      select: {
        googleClientIdEnc: true,
        googleClientSecretEnc: true,
        serperApiKeyEnc: true,
        calendarFilterMode: true,
        calendarKeyword: true,
      },
    }),
    resolveGoogleOAuthCredentials(userId),
    resolveSerperApiKey(userId),
  ])

  const gcalConn = connections.find((c) => c.provider === 'GOOGLE_CALENDAR')
  const refreshToken = gcalConn?.credentials
    ? decryptToken((gcalConn.credentials as { refreshToken?: string }).refreshToken)
    : null

  return {
    fathomOk: connections.some((c) => c.provider === 'FATHOM' && c.status === 'ACTIVE'),
    gcalOk: Boolean(gcalConn && gcalConn.status === 'ACTIVE'),
    gcalNeedsReconnect: googleCalendarNeedsReconnect(gcalConn || null, refreshToken, googleOAuth?.clientId),
    googleOAuthConfigured: Boolean(googleOAuth),
    hasUserGoogleOAuth: Boolean(settings?.googleClientIdEnc && settings?.googleClientSecretEnc),
    serperConfigured: Boolean(serperKey),
    hasUserSerperKey: Boolean(settings?.serperApiKeyEnc),
    calendarFilterMode: settings?.calendarFilterMode === 'KEYWORD' ? 'KEYWORD' : 'ALL',
    calendarKeyword: settings?.calendarKeyword || '[Sales]',
  }
}
