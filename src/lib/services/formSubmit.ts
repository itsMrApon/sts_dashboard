import 'server-only'
import nodemailer from 'nodemailer'
import { prismaClient } from '@/lib/prismaClient'
import { FORM_HONEYPOT_FIELD, validateFormValues, type FormServiceConfig } from '@/lib/services/types'

const SMTP_TIMEOUT_MS = 15_000

function smtpSettings() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  if (!host || !user || !pass || !from || Number.isNaN(port)) return null
  return { host, port, user, pass, from, secure }
}

export function isSmtpConfigured(): boolean {
  return smtpSettings() !== null
}

/** Sends a plain-text notification to the business owner. Returns false when SMTP is not configured. */
export async function sendOwnerEmail(input: {
  to: string
  subject: string
  text: string
  /** Lets the owner hit Reply to answer the visitor directly. */
  replyTo?: string
}): Promise<boolean> {
  const smtp = smtpSettings()
  if (!smtp) return false
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })
  await transporter.sendMail({
    from: smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo,
  })
  return true
}

export type FormSubmitResult =
  | { ok: true; message: string }
  | { ok: false; status: number; code: 'INVALID_FORM' | 'DELIVERY_FAILED'; error: string; fieldId?: string }

const SOURCE_LABEL = { sdk: 'your website', preview: 'dashboard test', hosted: 'form page' } as const

/**
 * Validates one Form submission and emails it to the business owner. Nothing is stored:
 * the email is the only copy, so a failed send is reported to the visitor instead of
 * pretending it went through. Shared by the SDK route, the hosted page and the dashboard test.
 */
export async function submitBusinessForm(input: {
  ownerUserId: string
  businessName: string
  config: FormServiceConfig
  values: unknown
  consent: boolean
  source: keyof typeof SOURCE_LABEL
}): Promise<FormSubmitResult> {
  // Spam trap: bots fill every field, including the hidden one. Look successful, send nothing.
  const trap = (input.values as Record<string, unknown> | null)?.[FORM_HONEYPOT_FIELD]
  if (input.config.spamProtection && typeof trap === 'string' && trap.trim()) {
    return { ok: true, message: input.config.successMessage }
  }
  const checked = validateFormValues(input.config, input.values, input.consent)
  if (!checked.ok) {
    return { ok: false, status: 400, code: 'INVALID_FORM', error: checked.error, fieldId: checked.fieldId }
  }

  const owner = input.config.notifyEmail
    ? null
    : await prismaClient.user.findUnique({ where: { id: input.ownerUserId }, select: { email: true } })
  const to = input.config.notifyEmail || owner?.email?.trim()
  const deliveryFailed = (reason: string): FormSubmitResult => {
    console.warn(`[form] not delivered (${input.source}): ${reason}`)
    return {
      ok: false,
      status: 503,
      code: 'DELIVERY_FAILED',
      error:
        input.source === 'preview'
          ? `Not sent: ${reason}`
          : "Sorry, we couldn't send your answers right now. Please try again in a moment.",
    }
  }
  if (!to) return deliveryFailed('no email address to send submissions to')
  if (!isSmtpConfigured()) return deliveryFailed('email (SMTP) is not set up on the server')

  const answered = input.config.fields.filter((field) => checked.values[field.id])
  const visitorEmail = answered.find((field) => field.type === 'email')
  const text = [
    `New answers from your "${input.config.title}" form.`,
    '',
    ...answered.flatMap((field) => [field.label, `  ${checked.values[field.id]}`, '']),
    `Sent from: ${SOURCE_LABEL[input.source]}`,
    `Time: ${new Date().toUTCString()}`,
  ].join('\n')

  try {
    await sendOwnerEmail({
      to,
      subject: `${input.config.title} · ${input.businessName}`,
      text,
      replyTo: visitorEmail ? checked.values[visitorEmail.id] : undefined,
    })
  } catch (error) {
    return deliveryFailed(error instanceof Error ? error.message : 'the email server refused the message')
  }

  return { ok: true, message: input.config.successMessage }
}
