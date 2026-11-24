import { logger } from '@trigger.dev/sdk'
import { isActiveJobProvider } from '@/lib/jobs/jobProvider'

/**
 * Scheduled tasks start with this: when Inngest is the active job runner (Integrations →
 * trigger.dev), the task returns this note instead of doing the work, so nothing runs twice.
 */
export async function skippedUnlessTrigger(): Promise<{ skipped: string } | null> {
  if (await isActiveJobProvider('trigger')) return null
  logger.info('Skipped: Inngest is the active job runner')
  return { skipped: 'Inngest is the active job runner' }
}
