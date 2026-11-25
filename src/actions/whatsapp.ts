'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { decryptedApiKey, saveWhatsAppConnection } from '@/lib/whatsapp/connection'
import { getPhoneNumber, KapsoError } from '@/lib/whatsapp/kapso'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function currentUserId() {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

function kapsoMessage(error: unknown): string {
  if (error instanceof KapsoError && (error.status === 401 || error.status === 403)) {
    return 'Kapso did not accept that API key. Copy it again from API keys in your Kapso project.'
  }
  if (error instanceof KapsoError && error.status === 404) return 'Kapso has no number with that Phone number ID.'
  return error instanceof Error ? error.message : 'Kapso did not answer. Try again.'
}

/** Saves the creator's Kapso key, number and webhook secret, after checking them with Kapso. */
export async function saveWhatsApp(input: {
  apiKey: string
  phoneNumberId: string
  webhookSecret: string
  aiReplies: boolean
}): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const phoneNumberId = input.phoneNumberId.trim()
  if (!/^\d{6,32}$/.test(phoneNumberId)) return { ok: false, error: 'The Phone number ID is the long number from Kapso (digits only).' }
  const existing = await decryptedApiKey(userId)
  const apiKey = input.apiKey.trim() || existing?.apiKey || ''
  if (!apiKey) return { ok: false, error: 'Paste your Kapso API key.' }
  if (!existing && !input.webhookSecret.trim()) {
    return { ok: false, error: 'Paste the webhook secret key you set on the Kapso webhook.' }
  }

  let displayPhone: string | null = null
  try {
    const number = await getPhoneNumber(apiKey, phoneNumberId)
    displayPhone = number.display_phone_number ?? null
  } catch (error) {
    return { ok: false, error: kapsoMessage(error) }
  }

  await saveWhatsAppConnection({
    userId,
    apiKey: input.apiKey.trim() || undefined,
    phoneNumberId,
    webhookSecret: input.webhookSecret.trim() || undefined,
    displayPhone,
    aiReplies: input.aiReplies,
  })
  revalidatePath('/social/whatsapp')
  revalidatePath('/integrations')
  revalidatePath('/social')
  return { ok: true, message: displayPhone ? `Connected ${displayPhone}` : 'WhatsApp connected' }
}

export async function testWhatsApp(): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const saved = await decryptedApiKey(userId)
  if (!saved) return { ok: false, error: 'Connect WhatsApp first.' }
  try {
    const number = await getPhoneNumber(saved.apiKey, saved.phoneNumberId)
    return { ok: true, message: `Kapso answered for ${number.display_phone_number ?? saved.phoneNumberId}.` }
  } catch (error) {
    return { ok: false, error: kapsoMessage(error) }
  }
}

export async function disconnectWhatsApp(): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  await prismaClient.whatsAppConnection.deleteMany({ where: { userId } })
  revalidatePath('/social/whatsapp')
  revalidatePath('/integrations')
  revalidatePath('/social')
  return { ok: true, message: 'WhatsApp disconnected' }
}
