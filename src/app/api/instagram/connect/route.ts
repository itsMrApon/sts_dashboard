import { NextResponse } from 'next/server'
import { onAuthenticateUser } from '@/actions/auth'
import { signState } from '@/lib/instagram/connection'
import { authorizeUrl, instagramAppConfig, instagramRedirectUri } from '@/lib/instagram/graph'

export const runtime = 'nodejs'

function appBaseUrl(req: Request): string {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '')
}

/** Sends the creator to Instagram to connect their professional account. */
export async function GET(req: Request) {
  const auth = await onAuthenticateUser()
  if (!auth.user) return NextResponse.redirect(new URL('/sign-in', req.url))
  const config = instagramAppConfig()
  if (!config) return NextResponse.redirect(new URL('/integrations/instagram?error=not_configured', req.url))
  return NextResponse.redirect(
    authorizeUrl({ appId: config.appId, redirectUri: instagramRedirectUri(appBaseUrl(req)), state: signState(auth.user.id) }),
  )
}
