'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { prismaClient } from '@/lib/prismaClient'
import {
  deleteBotWebhook,
  getBotInfo,
  sendTelegramMessage,
  setBotWebhook,
  TELEGRAM_TOKEN_RE,
} from '@/lib/telegram/telegramApi'

/** Integrations → Telegram: the creator's own bot, linked to one chat for buyer alerts. */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type TelegramSetupView = {
  botUsername: string
  enabled: boolean
  chatTitle: string | null
  /** When the chat was last linked; changes every time a chat is linked. */
  linkedAt: string | null
  /** Adds the bot to a group and links it in one step. */
  groupLinkUrl: string
  /** Links a private chat with the bot instead. */
  privateLinkUrl: string
}

async function requireWorkspace() {
  const auth = await onAuthenticateUser()
  if (!auth.user) return null
  const business = await getCreatorBusiness(auth.user.id)
  return business ? { userId: auth.user.id, workspaceId: business.workspaceId, businessName: business.name } : null
}

function toView(row: {
  botUsername: string
  enabled: boolean
  chatTitle: string | null
  chatId: string | null
  linkCode: string
  linkedAt: Date | null
}): TelegramSetupView {
  const base = `https://t.me/${row.botUsername}`
  return {
    botUsername: row.botUsername,
    enabled: row.enabled,
    chatTitle: row.chatId ? row.chatTitle : null,
    linkedAt: row.chatId ? (row.linkedAt?.toISOString() ?? null) : null,
    groupLinkUrl: `${base}?startgroup=${row.linkCode}`,
    privateLinkUrl: `${base}?start=${row.linkCode}`,
  }
}

const VIEW_SELECT = { botUsername: true, enabled: true, chatTitle: true, chatId: true, linkCode: true, linkedAt: true } as const

export async function getTelegramSetup(): Promise<TelegramSetupView | null> {
  const owner = await requireWorkspace()
  if (!owner) return null
  const row = await prismaClient.telegramConnection.findFirst({
    where: { workspaceId: owner.workspaceId, userId: owner.userId },
    select: VIEW_SELECT,
  })
  return row ? toView(row) : null
}

/** Checks the token with Telegram, points the bot's webhook at this app and saves it. */
export async function connectTelegramBot(input: { token: string }): Promise<Result<{ setup: TelegramSetupView }>> {
  const token = input.token?.trim() ?? ''
  if (!TELEGRAM_TOKEN_RE.test(token)) {
    return { ok: false, error: 'That does not look like a bot token. Copy the whole token @BotFather sent you.' }
  }
  const owner = await requireWorkspace()
  if (!owner) return { ok: false, error: 'Please sign in again' }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  if (!appUrl.startsWith('https://')) {
    return { ok: false, error: 'Telegram needs this app on a public https address (NEXT_PUBLIC_APP_URL).' }
  }

  const bot = await getBotInfo(token)
  if (!bot.ok) return { ok: false, error: `Telegram did not accept the token: ${bot.error}` }

  // A bot can only have one webhook: the previous owner of this bot (if any) stops getting updates.
  const existing = await prismaClient.telegramConnection.findFirst({
    where: { workspaceId: owner.workspaceId },
    select: { botTokenEnc: true },
  })
  const previousToken = decryptToken(existing?.botTokenEnc)
  if (previousToken && previousToken !== token) await deleteBotWebhook(previousToken)

  const webhookSecret = randomBytes(32).toString('base64url')
  const hooked = await setBotWebhook(token, `${appUrl}/api/telegram/webhook`, webhookSecret)
  if (!hooked.ok) return { ok: false, error: `Could not set up the bot: ${hooked.error}` }

  const sameBot = previousToken === token
  const data = {
    userId: owner.userId,
    botTokenEnc: encryptToken(token),
    botUsername: bot.result.username.slice(0, 64),
    webhookSecret,
    enabled: true,
  }
  const row = await prismaClient.telegramConnection.upsert({
    where: { workspaceId: owner.workspaceId },
    create: { workspaceId: owner.workspaceId, ...data, linkCode: randomBytes(9).toString('base64url') },
    // A different bot must be linked to a chat again.
    update: sameBot ? data : { ...data, linkCode: randomBytes(9).toString('base64url'), chatId: null, chatTitle: null, linkedAt: null },
    select: VIEW_SELECT,
  })
  revalidatePath('/integrations')
  return { ok: true, setup: toView(row) }
}

export async function setTelegramEnabled(input: { enabled: boolean }): Promise<Result> {
  const owner = await requireWorkspace()
  if (!owner) return { ok: false, error: 'Please sign in again' }
  const updated = await prismaClient.telegramConnection.updateMany({
    where: { workspaceId: owner.workspaceId, userId: owner.userId },
    data: { enabled: Boolean(input.enabled) },
  })
  return updated.count ? { ok: true } : { ok: false, error: 'Connect a bot first' }
}

export async function sendTelegramTest(): Promise<Result> {
  const owner = await requireWorkspace()
  if (!owner) return { ok: false, error: 'Please sign in again' }
  const row = await prismaClient.telegramConnection.findFirst({
    where: { workspaceId: owner.workspaceId, userId: owner.userId },
    select: { botTokenEnc: true, chatId: true },
  })
  const token = decryptToken(row?.botTokenEnc)
  if (!token || !row?.chatId) return { ok: false, error: 'Link a chat first' }
  const sent = await sendTelegramMessage(token, row.chatId, `Test from ${owner.businessName}. Alerts will arrive here.`)
  return sent.ok ? { ok: true } : { ok: false, error: sent.error }
}

/** Stops the bot's webhook and forgets the token. */
export async function disconnectTelegram(): Promise<Result> {
  const owner = await requireWorkspace()
  if (!owner) return { ok: false, error: 'Please sign in again' }
  const row = await prismaClient.telegramConnection.findFirst({
    where: { workspaceId: owner.workspaceId, userId: owner.userId },
    select: { botTokenEnc: true },
  })
  if (!row) return { ok: true }
  const token = decryptToken(row.botTokenEnc)
  if (token) await deleteBotWebhook(token)
  await prismaClient.telegramConnection.delete({ where: { workspaceId: owner.workspaceId } })
  revalidatePath('/integrations')
  return { ok: true }
}
