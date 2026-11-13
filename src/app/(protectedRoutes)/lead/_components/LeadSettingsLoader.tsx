import { loadLeadConnectionSettings } from '@/lib/leads/leadConnectionSettings'
import { LeadSettingsSheet } from './LeadSettingsSheet'

/** Streams the Lead settings panel in after the page shell (rendered inside Suspense). */
export async function LeadSettingsLoader({ userId }: { userId: string }) {
  const settings = await loadLeadConnectionSettings(userId)
  return <LeadSettingsSheet {...settings} />
}
