'use server'

import { onAuthenticateUser } from '@/actions/auth'
import {
  getProviderUsageDashboard,
  type ProviderUsageDashboard,
} from '@/lib/usage/providerUsage'

export async function getConfigAgentUsage(
  rangeDays: number,
): Promise<{ success: true; data: ProviderUsageDashboard } | { success: false }> {
  const auth = await onAuthenticateUser()
  if (!auth.user) return { success: false }

  const data = await getProviderUsageDashboard(auth.user.id, rangeDays)
  return { success: true, data }
}
