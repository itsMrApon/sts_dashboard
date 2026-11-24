import nodemailer from 'nodemailer'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'

/**
 * All outgoing email: form answers, callback requests, review requests and webinar reminders.
 * Each creator's mail goes out through their own SMTP account (Integrations → Email); without
 * one, the platform's SMTP_* account is used. Works in the app and in trigger.dev.
 */

const SMTP_TIMEOUT_MS = 15_000

export type SmtpSettings = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string | null
}

export type EmailSource = 'creator' | 'platform' | 'none'

function platformSmtp(): SmtpSettings | null {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const fromEmail = process.env.SMTP_FROM || user
  const port = Number(process.env.SMTP_PORT || 587)
  if (!host || !user || !pass || !fromEmail || Number.isNaN(port)) return null
  return { host, port, user, pass, fromEmail, fromName: null, secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' }
}

async function creatorSmtp(userId: string): Promise<SmtpSettings | null> {
  const row = await prismaClient.emailConnection.findUnique({ where: { userId } })
  const pass = row ? decryptToken(row.passwordEnc) : null
  if (!row || !pass) return null
  return { host: row.host, port: row.port, secure: row.secure, user: row.username, pass, fromEmail: row.fromEmail, fromName: row.fromName }
}

async function resolveSmtp(userId: string | null | undefined): Promise<{ settings: SmtpSettings; source: Exclude<EmailSource, 'none'> } | null> {
  const own = userId ? await creatorSmtp(userId) : null
  if (own) return { settings: own, source: 'creator' }
  const platform = platformSmtp()
  return platform ? { settings: platform, source: 'platform' } : null
}

/** Which account this creator's email goes out through. */
export async function emailSourceFor(userId: string | null | undefined): Promise<EmailSource> {
  return (await resolveSmtp(userId))?.source ?? 'none'
}

export async function canSendEmail(userId: string | null | undefined): Promise<boolean> {
  return (await emailSourceFor(userId)) !== 'none'
}

/** Addresses we made up for WhatsApp-only buyers and imports are never real inboxes. */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.(invalid|local)$/i.test(email))
}

function transportFor(smtp: SmtpSettings) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })
}

/** Logs in to the SMTP server without sending anything. Throws the server's reason on failure. */
export async function verifySmtp(smtp: SmtpSettings): Promise<void> {
  const transport = transportFor(smtp)
  try {
    await transport.verify()
  } finally {
    transport.close()
  }
}

/**
 * Sends one plain-text email for this creator. Returns false when no SMTP account is set up or
 * the address is not a real inbox; throws when the server refuses the message.
 */
export async function sendPlainEmail(input: {
  /** The creator the email is from; picks their own SMTP account. */
  userId: string | null | undefined
  to: string
  subject: string
  text: string
  replyTo?: string | null
  /** Shown as the sender's name when the creator's account has none (e.g. the business name). */
  fromName?: string | null
}): Promise<boolean> {
  if (!isDeliverableEmail(input.to)) return false
  const resolved = await resolveSmtp(input.userId)
  if (!resolved) return false
  const { settings, source } = resolved
  const transport = transportFor(settings)
  try {
    // An object (not a "Name <a@b>" string) so Bangla business names are encoded correctly.
    await transport.sendMail({
      from: { name: settings.fromName || input.fromName || '', address: settings.fromEmail },
      to: input.to,
      subject: input.subject,
      text: input.text,
      replyTo: input.replyTo || undefined,
    })
    return true
  } catch (error) {
    if (source === 'creator' && input.userId) {
      const reason = (error instanceof Error ? error.message : String(error)).slice(0, 500)
      await prismaClient.emailConnection.update({ where: { userId: input.userId }, data: { lastError: reason } }).catch(() => undefined)
    }
    throw error
  } finally {
    transport.close()
  }
}
