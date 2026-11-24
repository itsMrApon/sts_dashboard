import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { readState, saveInstagramConnection } from '@/lib/instagram/connection'
import {
  exchangeCodeForLongLivedToken,
  getMe,
  instagramAppConfig,
  instagramRedirectUri,
  subscribeToWebhooks,
} from '@/lib/instagram/graph'

export const runtime = 'nodejs'

function back(req: Request, query: string) {
  return NextResponse.redirect(new URL(`/integrations/instagram?${query}`, req.url))
}

/** Instagram sends the creator back here after they approve: save the account and its token. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('error')) return back(req, 'error=denied')
  const auth = await onAuthenticateUser()
  const stateUserId = readState(url.searchParams.get('state'))
  if (!auth.user || !stateUserId || stateUserId !== auth.user.id) return back(req, 'error=state')
  const config = instagramAppConfig()
  const code = url.searchParams.get('code')?.replace(/#_$/, '')
  if (!config || !code) return back(req, 'error=not_configured')

  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/+$/, '')
    const token = await exchangeCodeForLongLivedToken({
      code,
      redirectUri: instagramRedirectUri(baseUrl),
      appId: config.appId,
      appSecret: config.appSecret,
    })
    const me = await getMe(token.accessToken)
    if (!me.igUserId) return back(req, 'error=account')
    let subscribed = true
    await subscribeToWebhooks(token.accessToken).catch((error) => {
      subscribed = false
      console.warn('[instagram] webhook subscribe failed', error instanceof Error ? error.message : error)
    })
    await saveInstagramConnection({
      userId: auth.user.id,
      igUserId: me.igUserId,
      username: me.username,
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
      webhookSubscribed: subscribed,
    })
    revalidatePath('/integrations')
    return back(req, 'connected=1')
  } catch (error) {
    console.error('[instagram] connect failed', error)
    return back(req, 'error=exchange')
  }
}
