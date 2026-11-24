'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken, encryptToken } from '@/lib/messages/encrypt'
import { sendPlainEmail, verifySmtp, type SmtpSettings } from '@/lib/email/sendEmail'
import { smtpProvider } from '@/lib/email/smtpProviders'

type Result = { ok: true; message?: string } | { ok: false; error: string }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

/** Turns the SMTP server's reply into something a creator can act on. */
function smtpMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/535|534|invalid login|authentication|username and password/i.test(text)) {
    return 'The email server did not accept that username and password. Gmail and Zoho need an app password, Brevo an SMTP key, Resend an API key.'
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(text)) return 'That server name does not exist. Check the SMTP server.'
  if (/ETIMEDOUT|ECONNREFUSED|timeout|Greeting never received/i.test(text)) {
    return 'Could not reach the email server. Check the server and port (465 with SSL on, or 587 with SSL off).'
  }
  if (/wrong version number|SSL routines/i.test(text)) return 'The SSL setting does not match the port. Use SSL on for 465, off for 587.'
  return `The email server said: ${text.slice(0, 200)}`
}

export async function saveEmailConnection(input: {
  provider: string
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  fromEmail: string
  fromName: string
}): Promise<Result> {
  const auth = await onAuthenticateUser()
  const userId = auth.user?.id
  if (!userId) return { ok: false, error: 'Sign in again.' }

  const host = input.host.trim().toLowerCase()
  const port = Math.trunc(Number(input.port))
  const username = input.username.trim()
  const fromEmail = input.fromEmail.trim()
  const fromName = input.fromName.trim().slice(0, 120)
  if (!HOST_PATTERN.test(host)) return { ok: false, error: 'Enter the SMTP server, for example smtp.gmail.com.' }
  if (!Number.isFinite(port) || port < 1 || port > 65535) return { ok: false, error: 'The port is a number such as 465 or 587.' }
  if (!username) return { ok: false, error: 'Enter the username.' }
  if (!EMAIL_PATTERN.test(fromEmail)) return { ok: false, error: 'Enter the email address mail is sent from.' }

  const existing = await prismaClient.emailConnection.findUnique({ where: { userId }, select: { passwordEnc: true } })
  const password = input.password.trim() || decryptToken(existing?.passwordEnc) || ''
  if (!password) return { ok: false, error: 'Enter the password (or app password / key).' }

  const settings: SmtpSettings = { host, port, secure: Boolean(input.secure), user: username, pass: password, fromEmail, fromName: fromName || null }
  try {
    await verifySmtp(settings)
  } catch (error) {
    return { ok: false, error: smtpMessage(error) }
  }

  const data = {
    provider: smtpProvider(input.provider).id,
    host,
    port,
    secure: settings.secure,
    username,
    passwordEnc: encryptToken(password),
    fromEmail,
    fromName: fromName || null,
    verifiedAt: new Date(),
    lastError: null,
  }
  await prismaClient.emailConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  revalidatePath('/integrations/email')
  revalidatePath('/integrations')
  return { ok: true, message: 'Email connected. Send yourself a test to be sure.' }
}

/** Sends a short test email to the creator's own account address, through their connection. */
export async function sendTestEmail(): Promise<Result> {
  const auth = await onAuthenticateUser()
  const user = auth.user
  if (!user) return { ok: false, error: 'Sign in again.' }
  if (!user.email) return { ok: false, error: 'Your account has no email address to send the test to.' }
  try {
    const sent = await sendPlainEmail({
      userId: user.id,
      to: user.email,
      subject: 'sts-ai test email ✓',
      text: [
        'This is a test from sts-ai.',
        '',
        'Form answers, callback requests, review requests and webinar reminders will be sent from this account.',
        'পরীক্ষা: বাংলা লেখা ঠিকভাবে দেখা যাচ্ছে।',
      ].join('\n'),
    })
    if (!sent) return { ok: false, error: 'No email account is connected yet.' }
    await prismaClient.emailConnection.updateMany({ where: { userId: user.id }, data: { lastError: null } })
    revalidatePath('/integrations/email')
    return { ok: true, message: `Sent to ${user.email}. Check your inbox (and spam).` }
  } catch (error) {
    revalidatePath('/integrations/email')
    return { ok: false, error: smtpMessage(error) }
  }
}

export async function disconnectEmail(): Promise<Result> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'Sign in again.' }
  await prismaClient.emailConnection.deleteMany({ where: { userId: auth.user.id } })
  revalidatePath('/integrations/email')
  revalidatePath('/integrations')
  return { ok: true, message: 'Email disconnected' }
}
