import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { getEngineForUser } from '@/lib/agents/engineSettings'
import { prismaClient } from '@/lib/prismaClient'
import { providerKeyStatuses } from '@/lib/credentials/providerKeys'
import { isConfigCredentialProvider } from '@/lib/usage/configProviders'
import { getUserVoiceCredentialByUserId } from '@/lib/voiceCredentialsRepo'
import ProviderHub from '../_components/config/ProviderHub'

export default async function ConfigAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string | string[] }>
}) {
  const authResult = await onAuthenticateUser()
  const userId = authResult.user?.id
  if (!userId) redirect('/sign-in')

  const [{ provider }, credentialRow, engineView, agentCount] = await Promise.all([
    searchParams,
    getUserVoiceCredentialByUserId(userId),
    getEngineForUser(userId),
    prismaClient.liveKitAgent.count({ where: { userId } }),
  ])
  const requestedProvider = Array.isArray(provider) ? provider[0] : provider

  return (
    <PageViewport scrollable>
      <ProviderHub
        initialStatuses={providerKeyStatuses(credentialRow)}
        initialEngine={engineView.engine}
        initialVoiceLabel={engineView.voiceLabel}
        savedBefore={engineView.source === 'settings'}
        agentCount={agentCount}
        initialOpenProvider={isConfigCredentialProvider(requestedProvider) ? requestedProvider : null}
      />
    </PageViewport>
  )
}
