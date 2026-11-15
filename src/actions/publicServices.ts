'use server'

import { headers } from 'next/headers'
import { clientIp } from '@/lib/embed/clientIp'
import { checkRateLimit, consumeDailyQuota, EMBED_DAILY_QUOTAS, EMBED_RATE_LIMITS } from '@/lib/embed/rateLimit'
import { loadPublicBusiness, serviceAccess } from '@/lib/public/publicService'
import { submitBusinessForm } from '@/lib/services/formSubmit'
import type { FormAnswers } from '@/lib/services/types'

type FormResult = { ok: true; message: string } | { ok: false; error: string; fieldId?: string }

const TOO_MANY = 'Too many submissions. Please try again later.'

/** Submit on the hosted Form page (/form/[roomName]). Same limits as the website SDK form. */
export async function submitHostedForm(input: {
  roomName: string
  values: FormAnswers
  consent: boolean
}): Promise<FormResult> {
  const roomName = typeof input.roomName === 'string' ? input.roomName.slice(0, 255) : ''
  if (!roomName) return { ok: false, error: 'Form not found' }

  const ip = clientIp(await headers())
  const { limit, windowMs } = EMBED_RATE_LIMITS.mobile
  if (!(await checkRateLimit(`hosted-form:${roomName}:${ip}`, limit, windowMs)).ok) {
    return { ok: false, error: TOO_MANY }
  }

  const loaded = await loadPublicBusiness(roomName)
  if (!loaded || serviceAccess(loaded, 'form') === 'off') return { ok: false, error: 'This form is not available' }

  const quota = await consumeDailyQuota(`hosted-form:${loaded.business.workspaceId}`, EMBED_DAILY_QUOTAS.mobile)
  if (!quota.ok) return { ok: false, error: TOO_MANY }

  try {
    const result = await submitBusinessForm({
      ownerUserId: loaded.business.userId,
      businessName: loaded.business.name,
      config: loaded.services.form.config,
      values: input.values,
      consent: input.consent === true,
      source: loaded.isOwner ? 'preview' : 'hosted',
    })
    return result.ok ? { ok: true, message: result.message } : { ok: false, error: result.error, fieldId: result.fieldId }
  } catch (error) {
    console.error('[hosted-form]', error)
    return { ok: false, error: 'Could not send. Please try again.' }
  }
}
