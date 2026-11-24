/**
 * Instagram API with Instagram Login (graph.instagram.com), over fetch with timeouts. Uses the
 * platform's one Meta app: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET. Creators only connect their
 * own account through it.
 */

const GRAPH = 'https://graph.instagram.com'
const VERSION = 'v22.0'
const TIMEOUT_MS = 15_000

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_comments',
  'instagram_business_manage_messages',
] as const

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null = null,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

export function instagramAppConfig() {
  const appId = process.env.INSTAGRAM_APP_ID?.trim()
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim()
  return appId && appSecret ? { appId, appSecret } : null
}

export function instagramRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/instagram/callback`
}

async function readJson(res: Response) {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: number } | string
    error_message?: string
  }
  if (!res.ok) {
    const error = typeof body.error === 'object' ? body.error : null
    const message = error?.message || body.error_message || (typeof body.error === 'string' ? body.error : '') || `Instagram answered ${res.status}`
    throw new InstagramApiError(message, res.status, error?.code ?? null)
  }
  return body
}

function timeout() {
  return AbortSignal.timeout(TIMEOUT_MS)
}

export function authorizeUrl(input: { appId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_SCOPES.join(','),
    state: input.state,
    enable_fb_login: '0',
  })
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`
}

/** Login code → short-lived token → long-lived token (about 60 days). */
export async function exchangeCodeForLongLivedToken(input: { code: string; redirectUri: string; appId: string; appSecret: string }) {
  const short = await readJson(
    await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: input.appId,
        client_secret: input.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: input.redirectUri,
        code: input.code,
      }),
      signal: timeout(),
    }),
  )
  const shortToken = String(short.access_token ?? '')
  if (!shortToken) throw new InstagramApiError('Instagram did not return a token', 502)
  const long = await readJson(
    await fetch(
      `${GRAPH}/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: input.appSecret, access_token: shortToken })}`,
      { signal: timeout() },
    ),
  )
  return { accessToken: String(long.access_token), expiresIn: Number(long.expires_in ?? 0) }
}

export async function refreshLongLivedToken(accessToken: string) {
  const body = await readJson(
    await fetch(`${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken })}`, {
      signal: timeout(),
    }),
  )
  return { accessToken: String(body.access_token), expiresIn: Number(body.expires_in ?? 0) }
}

/** The connected professional account: its id (as used in webhooks) and username. */
export async function getMe(accessToken: string) {
  const body = await readJson(
    await fetch(`${GRAPH}/${VERSION}/me?${new URLSearchParams({ fields: 'user_id,username', access_token: accessToken })}`, {
      signal: timeout(),
    }),
  )
  return { igUserId: String(body.user_id ?? body.id ?? ''), username: body.username ? String(body.username) : null }
}

/** Turns on comment and message webhooks for this account (the app's webhook must be set up). */
export async function subscribeToWebhooks(accessToken: string) {
  await readJson(
    await fetch(
      `${GRAPH}/${VERSION}/me/subscribed_apps?${new URLSearchParams({ subscribed_fields: 'comments,messages', access_token: accessToken })}`,
      { method: 'POST', signal: timeout() },
    ),
  )
}

export type InstagramMedia = { id: string; caption: string | null; thumbnail: string | null; permalink: string | null; timestamp: string | null }

export async function listRecentMedia(accessToken: string, limit = 12): Promise<InstagramMedia[]> {
  const body = await readJson(
    await fetch(
      `${GRAPH}/${VERSION}/me/media?${new URLSearchParams({
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
        limit: String(limit),
        access_token: accessToken,
      })}`,
      { signal: timeout() },
    ),
  )
  const data = Array.isArray(body.data) ? (body.data as Record<string, unknown>[]) : []
  return data.map((item) => ({
    id: String(item.id),
    caption: item.caption ? String(item.caption).slice(0, 200) : null,
    thumbnail: String(item.thumbnail_url ?? (item.media_type === 'VIDEO' ? '' : item.media_url ?? '')) || null,
    permalink: item.permalink ? String(item.permalink) : null,
    timestamp: item.timestamp ? String(item.timestamp) : null,
  }))
}

/** A private reply: one DM to the person who wrote this comment (within 7 days of it). */
export async function sendPrivateReply(accessToken: string, commentId: string, text: string) {
  return readJson(
    await fetch(`${GRAPH}/${VERSION}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: text.slice(0, 1000) } }),
      signal: timeout(),
    }),
  )
}

/** A DM inside the 24-hour window after the person wrote to the account. */
export async function sendDirectMessage(accessToken: string, recipientId: string, text: string) {
  return readJson(
    await fetch(`${GRAPH}/${VERSION}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 1000) } }),
      signal: timeout(),
    }),
  )
}

export async function replyToComment(accessToken: string, commentId: string, text: string) {
  return readJson(
    await fetch(`${GRAPH}/${VERSION}/${encodeURIComponent(commentId)}/replies?${new URLSearchParams({ message: text.slice(0, 300) })}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: timeout(),
    }),
  )
}
