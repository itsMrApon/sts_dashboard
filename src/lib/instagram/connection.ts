import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'

/** Each creator's connected Instagram account, and the signed state used during login. */

const STATE_MAX_AGE_MS = 15 * 60 * 1000

function stateSecret(): string {
  return process.env.INSTAGRAM_APP_SECRET || process.env.ENCRYPTION_KEY || ''
}

/** "userId.issuedAt.nonce.signature": ties the login callback to the creator who started it. */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}.${randomBytes(8).toString('hex')}`
  const signature = createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function readState(state: string | null): string | null {
  if (!state || !stateSecret()) return null
  const parts = state.split('.')
  if (parts.length !== 4) return null
  const [userId, issuedAt, nonce, signature] = parts
  const expected = createHmac('sha256', stateSecret()).update(`${userId}.${issuedAt}.${nonce}`).digest('base64url')
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  if (Date.now() - Number(issuedAt) > STATE_MAX_AGE_MS) return null
  return userId
}

export async function saveInstagramConnection(input: {
  userId: string
  igUserId: string
  username: string | null
  accessToken: string
  expiresIn: number
  webhookSubscribed: boolean
}) {
  const data = {
    igUserId: input.igUserId,
    username: input.username,
    accessTokenEnc: encryptToken(input.accessToken),
    tokenExpiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null,
    webhookSubscribed: input.webhookSubscribed,
  }
  // An Instagram account belongs to one creator: connecting it elsewhere moves it.
  await prismaClient.instagramConnection.deleteMany({ where: { igUserId: input.igUserId, NOT: { userId: input.userId } } })
  return prismaClient.instagramConnection.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, ...data },
    update: data,
  })
}

export async function instagramTokenFor(userId: string) {
  const row = await prismaClient.instagramConnection.findUnique({ where: { userId } })
  const token = decryptToken(row?.accessTokenEnc)
  return row && token ? { token, igUserId: row.igUserId, username: row.username } : null
}

export async function connectionByIgUserId(igUserId: string) {
  const row = await prismaClient.instagramConnection.findUnique({ where: { igUserId } })
  const token = decryptToken(row?.accessTokenEnc)
  return row && token ? { userId: row.userId, igUserId: row.igUserId, token } : null
}
