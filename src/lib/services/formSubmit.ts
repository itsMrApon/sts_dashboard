import 'server-only'
import { prismaClient } from '@/lib/prismaClient'
import { canSendEmail, sendPlainEmail } from '@/lib/email/sendEmail'
import { FORM_HONEYPOT_FIELD, validateFormValues, type FormServiceConfig } from '@/lib/services/types'

export type FormSubmitResult =
  | { ok: true; message: string }
  | { ok: false; status: number; code: 'INVALID_FORM' | 'DELIVERY_FAILED'; error: string; fieldId?: string }

const SOURCE_LABEL = { sdk: 'your website', preview: 'dashboard test', hosted: 'form page' } as const

/** One saved answer: the question as the creator wrote it, and the visitor's text as typed. */
export type SavedFormAnswer = { id: string; label: string; type: string; value: string }

/**
 * Keeps a copy of every real submission (dashboard tests are skipped), so answers are not lost
 * when email fails and the questions people ask can feed the project's Questions later.
 * A failed save never blocks the email.
 */
async function saveSubmission(input: {
  workspaceId: string
  source: string
  formTitle: string
  answers: SavedFormAnswer[]
  cameFrom: string | null
}): Promise<string | null> {
  try {
    const row = await prismaClient.formSubmission.create({
      data: {
        workspaceId: input.workspaceId,
        source: input.source,
        fields: { formTitle: input.formTitle, answers: input.answers, cameFrom: input.cameFrom, delivered: false },
      },
      select: { id: true },
    })
    return row.id
  } catch (error) {
    console.error('[form] could not save submission', error)
    return null
  }
}

async function markDelivered(id: string, formTitle: string, answers: SavedFormAnswer[], cameFrom: string | null) {
  await prismaClient.formSubmission
    .update({ where: { id }, data: { fields: { formTitle, answers, cameFrom, delivered: true } } })
    .catch((error) => console.error('[form] could not mark submission delivered', error))
}

/**
 * Validates one Form submission, saves it, and emails it to the business owner. A failed email
 * is still reported to the visitor (so they can try again or reach out another way), but the
 * saved copy keeps the answers. Shared by the SDK route, the hosted page and the dashboard test.
 */
export async function submitBusinessForm(input: {
  ownerUserId: string
  workspaceId: string
  businessName: string
  config: FormServiceConfig
  values: unknown
  consent: boolean
  source: keyof typeof SOURCE_LABEL
  /** Where the visitor came from (the link's `?src=` tag), already normalized. */
  cameFrom?: string | null
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

  const answers: SavedFormAnswer[] = input.config.fields
    .filter((field) => checked.values[field.id])
    .map((field) => ({ id: field.id, label: field.label, type: field.type, value: checked.values[field.id] }))
  const savedId =
    input.source === 'preview'
      ? null
      : await saveSubmission({
          workspaceId: input.workspaceId,
          source: input.source,
          formTitle: input.config.title,
          answers,
          cameFrom: input.cameFrom ?? null,
        })

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
  if (!(await canSendEmail(input.ownerUserId))) return deliveryFailed('email (SMTP) is not set up: add it in Integrations → Email')

  const answered = input.config.fields.filter((field) => checked.values[field.id])
  const visitorEmail = answered.find((field) => field.type === 'email')
  const text = [
    `New answers from your "${input.config.title}" form.`,
    '',
    ...answered.flatMap((field) => [field.label, `  ${checked.values[field.id]}`, '']),
    `Sent from: ${SOURCE_LABEL[input.source]}`,
    ...(input.cameFrom ? [`Came from: ${input.cameFrom}`] : []),
    `Time: ${new Date().toUTCString()}`,
  ].join('\n')

  try {
    const sent = await sendPlainEmail({
      userId: input.ownerUserId,
      fromName: input.businessName,
      to,
      subject: `${input.config.title} · ${input.businessName}`,
      text,
      replyTo: visitorEmail ? checked.values[visitorEmail.id] : undefined,
    })
    if (!sent) return deliveryFailed(`${to} is not an address email can be sent to`)
  } catch (error) {
    return deliveryFailed(error instanceof Error ? error.message : 'the email server refused the message')
  }

  if (savedId) await markDelivered(savedId, input.config.title, answers, input.cameFrom ?? null)
  return { ok: true, message: input.config.successMessage }
}
