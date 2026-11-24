import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { encryptToken } from '@/lib/messages/encrypt'
import {
  exchangeGoogleCode,
  resolveGoogleOAuthCredentials,
  hasCalendarScope,
} from '@/lib/leads/googleCalendar'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  if (err) {
    return NextResponse.redirect(
      new URL(`/lead/calendar?gcal=error&msg=${encodeURIComponent(err)}`, req.url),
    )
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL('/lead/calendar?gcal=missing', req.url))
  }

  let userId: string
  try {
    const state = JSON.parse(
      Buffer.from(stateRaw, 'base64url').toString('utf8'),
    ) as { userId?: string }
    if (!state.userId) throw new Error('no userId')
    userId = state.userId
  } catch {
    return NextResponse.redirect(new URL('/lead/calendar?gcal=bad_state', req.url))
  }

  try {
    const oauth = await resolveGoogleOAuthCredentials(userId)
    if (!oauth) {
      return NextResponse.redirect(new URL('/lead/calendar?gcal=missing_oauth', req.url))
    }

    const origin = url.origin
    const tokens = await exchangeGoogleCode({
      code,
      origin,
      clientId: oauth.clientId,
      clientSecret: oauth.clientSecret,
    })

    // Google lets people untick the calendar permission; without it every calendar call fails.
    if (!hasCalendarScope(tokens.scope)) {
      return NextResponse.redirect(new URL('/lead/calendar?gcal=missing_scope', req.url))
    }

    const existing = await prismaClient.callIntelConnection.findUnique({
      where: {
        userId_provider: { userId, provider: 'GOOGLE_CALENDAR' },
      },
      select: { credentials: true },
    })
    const previousRefresh = (
      existing?.credentials as { refreshToken?: string } | null
    )?.refreshToken

    // Google often omits refresh_token on re-consent if one already exists.
    // Keep the previous encrypted token instead of failing with no_refresh.
    const refreshTokenEnc = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : previousRefresh

    if (!refreshTokenEnc) {
      return NextResponse.redirect(new URL('/lead/calendar?gcal=no_refresh', req.url))
    }

    await prismaClient.callIntelConnection.upsert({
      where: {
        userId_provider: { userId, provider: 'GOOGLE_CALENDAR' },
      },
      create: {
        userId,
        provider: 'GOOGLE_CALENDAR',
        status: 'ACTIVE',
        credentials: {
          refreshToken: refreshTokenEnc,
        },
        metadata: {
          connectedAt: new Date().toISOString(),
          oauthSource: oauth.source,
          oauthClientId: oauth.clientId,
          grantedScopes: tokens.scope ?? null,
        },
      },
      update: {
        status: 'ACTIVE',
        credentials: {
          refreshToken: refreshTokenEnc,
        },
        metadata: {
          connectedAt: new Date().toISOString(),
          oauthSource: oauth.source,
          oauthClientId: oauth.clientId,
          grantedScopes: tokens.scope ?? null,
          lastError: null,
          revokedAt: null,
        },
      },
    })

    revalidatePath('/lead', 'layout')
    revalidatePath('/settings')
    return NextResponse.redirect(new URL('/lead/calendar?gcal=connected', req.url))
  } catch (error) {
    console.error('Google Calendar callback failed', error)
    return NextResponse.redirect(new URL('/lead/calendar?gcal=failed', req.url))
  }
}
