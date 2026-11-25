'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { decideCliLogin, revokeCliToken } from '@/lib/cli/cliAuth'

type Result = { ok: true } | { ok: false; error: string }

async function currentUserId() {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

/** The creator approves (or refuses) a CLI login shown on /cli/authorize. */
export async function decideCliLoginAction(input: { userCode: string; approve: boolean }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const done = await decideCliLogin({ userCode: input.userCode, userId, approve: input.approve })
  if (!done) return { ok: false, error: 'This code has expired or was already used. Run the command again.' }
  revalidatePath('/social')
  return { ok: true }
}

/** Disconnects one agent: its token stops working at once. */
export async function revokeCliTokenAction(input: { tokenId: string }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const done = await revokeCliToken({ userId, tokenId: input.tokenId })
  if (!done) return { ok: false, error: 'That agent was already disconnected.' }
  revalidatePath('/social')
  return { ok: true }
}
