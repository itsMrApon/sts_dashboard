import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'

/** Each creator's WhatsApp (Kapso) connection: saving, looking up by webhook token, verifying. */

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function webhookUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/whatsapp/webhook/${token}`
}

export type WhatsAppConnectionView = {
  connected: boolean
  phoneNumberId: string | null
  displayPhone: string | null
  aiReplies: boolean
  webhookToken: string | null
  lastInboundAt: string | null
}

export async function loadWhatsAppConnectionView(userId: string): Promise<WhatsAppConnectionView> {
  const row = await prismaClient.whatsAppConnection.findUnique({ where: { userId } })
  if (!row) {
    return { connected: false, phoneNumberId: null, displayPhone: null, aiReplies: true, webhookToken: null, lastInboundAt: null }
  }
  return {
    connected: true,
    phoneNumberId: row.phoneNumberId,
    displayPhone: row.displayPhone,
    aiReplies: row.aiReplies,
    webhookToken: decryptToken(row.webhookTokenEnc),
    lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
  }
}

/** Saves or updates the connection. Blank secrets keep the saved ones; the webhook token stays. */
export async function saveWhatsAppConnection(input: {
  userId: string
  apiKey?: string
  phoneNumberId: string
  webhookSecret?: string
  displayPhone: string | null
  aiReplies: boolean
}) {
  const existing = await prismaClient.whatsAppConnection.findUnique({ where: { userId: input.userId } })
  if (!existing) {
    if (!input.apiKey || !input.webhookSecret) throw new Error('API key and webhook secret are required')
    const token = randomBytes(24).toString('base64url')
    return prismaClient.whatsAppConnection.create({
      data: {
        userId: input.userId,
        apiKeyEnc: encryptToken(input.apiKey),
        phoneNumberId: input.phoneNumberId,
        webhookSecretEnc: encryptToken(input.webhookSecret),
        webhookTokenEnc: encryptToken(token),
        webhookTokenHash: hashToken(token),
        displayPhone: input.displayPhone,
        aiReplies: input.aiReplies,
      },
    })
  }
  return prismaClient.whatsAppConnection.update({
    where: { userId: input.userId },
    data: {
      phoneNumberId: input.phoneNumberId,
      displayPhone: input.displayPhone ?? existing.displayPhone,
      aiReplies: input.aiReplies,
      ...(input.apiKey ? { apiKeyEnc: encryptToken(input.apiKey) } : {}),
      ...(input.webhookSecret ? { webhookSecretEnc: encryptToken(input.webhookSecret) } : {}),
    },
  })
}

export type ResolvedConnection = {
  id: string
  userId: string
  apiKey: string
  phoneNumberId: string
  webhookSecret: string
  aiReplies: boolean
}

/** The connection a webhook URL token belongs to, with its secrets decrypted. */
export async function findConnectionByToken(token: string): Promise<ResolvedConnection | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const row = await prismaClient.whatsAppConnection.findUnique({ where: { webhookTokenHash: hashToken(token) } })
  if (!row) return null
  const apiKey = decryptToken(row.apiKeyEnc)
  const webhookSecret = decryptToken(row.webhookSecretEnc)
  if (!apiKey || !webhookSecret) return null
  return { id: row.id, userId: row.userId, apiKey, phoneNumberId: row.phoneNumberId, webhookSecret, aiReplies: row.aiReplies }
}

export async function decryptedApiKey(userId: string) {
  const row = await prismaClient.whatsAppConnection.findUnique({ where: { userId } })
  if (!row) return null
  const apiKey = decryptToken(row.apiKeyEnc)
  return apiKey ? { apiKey, phoneNumberId: row.phoneNumberId } : null
}

/** Kapso signs the raw body: hex HMAC-SHA256 with the webhook's secret_key, no prefix. */
export function verifyKapsoSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const given = signature.trim().replace(/^sha256=/i, '')
  if (given.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(expected, 'utf8'))
}

/** True the first time a delivery key is seen; false for a retry already handled. */
export async function claimDelivery(key: string, source: string): Promise<boolean> {
  try {
    await prismaClient.webhookDelivery.create({ data: { key: key.slice(0, 200), source } })
    return true
  } catch {
    return false
  }
}
