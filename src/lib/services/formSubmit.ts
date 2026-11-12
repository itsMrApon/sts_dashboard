import 'server-only'
import nodemailer from 'nodemailer'
import { prismaClient } from '@/lib/prismaClient'
import { validateFormValues, type FormServiceConfig } from '@/lib/services/types'

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

/** Sends a plain-text notification to the business owner. Returns false when SMTP is not configured. */
export async function sendOwnerEmail(input: { to: string; subject: string; text: string }): Promise<boolean> {
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
  await transporter.sendMail({ from: smtp.from, to: input.to, subject: input.subject, text: input.text })
  return true
}

export type FormSubmitResult =
  | { ok: true; message: string; emailed: boolean }
  | { ok: false; status: number; error: string; fieldId?: string }

/** Validates, stores, and emails one Form submission. Shared by the SDK route and the dashboard preview. */
export async function submitBusinessForm(input: {
  workspaceId: string
  ownerUserId: string
  businessName: string
  config: FormServiceConfig
  values: unknown
  consent: boolean
  source: 'sdk' | 'preview' | 'hosted'
}): Promise<FormSubmitResult> {
  const checked = validateFormValues(input.config, input.values, input.consent)
  if (!checked.ok) return { ok: false, status: 400, error: checked.error, fieldId: checked.fieldId }

  await prismaClient.formSubmission.create({
    data: { workspaceId: input.workspaceId, fields: checked.values, source: input.source },
  })

  let emailed = false
  try {
    const owner = input.config.notifyEmail
      ? null
      : await prismaClient.user.findUnique({ where: { id: input.ownerUserId }, select: { email: true } })
    const to = input.config.notifyEmail || owner?.email?.trim()
    if (to) {
      const lines = input.config.fields
        .filter((field) => checked.values[field.id])
        .map((field) => `${field.label}: ${checked.values[field.id]}`)
      emailed = await sendOwnerEmail({
        to,
        subject: `${input.config.title} · ${input.businessName}`,
        text: [...lines, '', `Source: ${input.source}`, `Time: ${new Date().toISOString()}`].join('\n'),
      })
    }
  } catch (error) {
    // The submission is stored either way; email is best-effort.
    console.warn('[form] notification email failed', error)
  }

  return { ok: true, message: input.config.successMessage, emailed }
}
