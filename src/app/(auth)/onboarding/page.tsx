import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { resolveUserProviderKey } from '@/lib/credentials/providerKeys'
import { ensureGuideAgent } from '@/lib/onboarding/setupGuide'
import { OnboardingFlow, type CardId } from './_components/OnboardingFlow'

/**
 * Setup, one small card at a time: keys → business → first agent → tools → leads → finish. Progress
 * after the workspace exists is saved on it, so a refresh or a later visit resumes here.
 */
export default async function OnboardingPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const userId = auth.user.id
  const [business, geminiKey, cartesiaKey] = await Promise.all([
    getCreatorBusiness(userId),
    resolveUserProviderKey(userId, 'google'),
    resolveUserProviderKey(userId, 'cartesia'),
  ])
  if (business && !business.onboardingStep) redirect('/home')

  const keysReady = Boolean(geminiKey && cartesiaKey)
  let start: CardId
  if (!business) start = keysReady ? 'name' : 'keys'
  else start = business.onboardingStep === 'agent' ? 'service' : business.onboardingStep === 'tools' ? 'tools' : business.onboardingStep === 'leads' ? 'leads' : 'finish'
  // Keys saved some other way (e.g. Config) skip card 1, so the wizard is made here instead.
  if (keysReady) await ensureGuideAgent(userId)

  return (
    <OnboardingFlow
      start={start}
      businessName={business?.name ?? null}
      savedKeys={{ gemini: Boolean(geminiKey), cartesia: Boolean(cartesiaKey) }}
    />
  )
}
