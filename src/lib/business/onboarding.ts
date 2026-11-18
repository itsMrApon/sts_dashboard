/**
 * Setup progress, stored on the workspace (Workspace.onboardingStep). Null = finished.
 * The keys and business cards come before the workspace exists, so stored steps start at "agent".
 */
export const ONBOARDING_RESUME_STEPS = ['agent', 'tools', 'leads', 'finish'] as const
export type OnboardingResumeStep = (typeof ONBOARDING_RESUME_STEPS)[number]

export function isOnboardingResumeStep(value: unknown): value is OnboardingResumeStep {
  return typeof value === 'string' && (ONBOARDING_RESUME_STEPS as readonly string[]).includes(value)
}

/** Stored value → step. "keys" was the last step's earlier name. Anything unknown counts as finished. */
export function normalizeOnboardingStep(value: unknown): OnboardingResumeStep | null {
  if (value === 'keys') return 'finish'
  return isOnboardingResumeStep(value) ? value : null
}

/** Later steps rank higher: progress only moves forward. */
export function onboardingRank(step: OnboardingResumeStep): number {
  return ONBOARDING_RESUME_STEPS.indexOf(step)
}
