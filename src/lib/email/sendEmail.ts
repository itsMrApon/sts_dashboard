import nodemailer from 'nodemailer'

/**
 * Plain-text email from the platform's SMTP account (SMTP_* env vars), for messages to
 * customers such as review requests and webinar reminders. Works in the app and in trigger.dev.
 */

const SMTP_TIMEOUT_MS = 15_000

let transport: ReturnType<typeof nodemailer.createTransport> | null = null

function settings() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  if (!host || !user || !pass || !from) return null
  return { host, user, pass, from, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' }
}

export function canSendEmail(): boolean {
  return settings() !== null
}

/** Addresses we made up for WhatsApp-only buyers and imports are never real inboxes. */
export function isDeliverableEmail(email: string | null | undefined): email is string {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.(invalid|local)$/i.test(email))
}

export async function sendPlainEmail(input: { to: string; subject: string; text: string; replyTo?: string | null }): Promise<boolean> {
  const smtp = settings()
  if (!smtp || !isDeliverableEmail(input.to)) return false
  transport ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })
  await transport.sendMail({ from: smtp.from, to: input.to, subject: input.subject, text: input.text, replyTo: input.replyTo ?? undefined })
  return true
}
