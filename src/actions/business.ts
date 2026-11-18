'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { createCreatorBusiness } from '@/lib/business/creatorBusiness'

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** Onboarding: the only place a business is created (one per creator). */
export async function createMyBusiness(input: {
  name: string
  type?: string
  location?: string
}): Promise<ActionResult> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED' }
  if (!input.name?.trim()) return { ok: false, error: 'Business name is required' }

  try {
    await createCreatorBusiness(auth.user.id, {
      name: input.name,
      type: typeof input.type === 'string' ? input.type : null,
      location: typeof input.location === 'string' ? input.location : null,
    })
  } catch (error) {
    console.error('[createMyBusiness]', error)
    return { ok: false, error: 'Could not create your business. Please try again.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}
