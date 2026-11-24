import { logger, schedules, task } from '@trigger.dev/sdk'
import {
  listLeadIntelCreators,
  listMapsBatchCreators,
  runLeadIntelForCreator,
  runMapsBatchForCreator,
  type MapsBatchCreator,
} from '@/lib/leads/leadIntelJobs'
import { skippedUnlessTrigger } from './activeProvider'

/**
 * Replaces the old /api/cron/lead-intel route. Once a day the scheduler starts one run per
 * creator, so a slow or failing creator never holds up the others, and every run shows in the
 * trigger.dev dashboard with its own logs and retries.
 */

/** Calendar briefs, Fathom catch-up, scoring and research for one creator. */
export const leadIntelForCreator = task({
  id: 'lead-intel-creator',
  queue: { concurrencyLimit: 5 },
  run: async (payload: { userId: string }) => {
    const summary = await runLeadIntelForCreator(payload.userId)
    if (summary.errors.length > 0) logger.warn('Some lead jobs failed', { userId: payload.userId, errors: summary.errors })
    return summary
  },
})

/** Ten new Google Maps businesses for one creator. Serper and the scrape agent are slow, so few at once. */
export const mapsBatchForCreator = task({
  id: 'maps-batch-creator',
  queue: { concurrencyLimit: 2 },
  run: async (payload: MapsBatchCreator) => {
    const result = await runMapsBatchForCreator(payload)
    if (result.status === 'done' && !result.scrapeAgent) {
      logger.warn('Scrape agent not configured; websites were not scraped', { userId: payload.userId })
    }
    return result
  },
})

/** Starts one run per creator for the lead jobs and the Maps batch. */
async function startDailyLeadJobs() {
  const [creators, mapsCreators] = await Promise.all([listLeadIntelCreators(), listMapsBatchCreators()])
  if (creators.length > 0) {
    await leadIntelForCreator.batchTrigger(creators.map((userId) => ({ payload: { userId } })))
  }
  if (mapsCreators.length > 0) {
    await mapsBatchForCreator.batchTrigger(mapsCreators.map((creator) => ({ payload: creator })))
  }
  logger.info('Started daily lead jobs', { creators: creators.length, mapsBatches: mapsCreators.length })
  return { creators: creators.length, mapsBatches: mapsCreators.length }
}

/** Every day at 01:00 UTC, the same time the cron route ran. */
export const leadIntelDaily = schedules.task({
  id: 'lead-intel-daily',
  cron: '0 1 * * *',
  run: async () => (await skippedUnlessTrigger()) ?? startDailyLeadJobs(),
})

/** The same jobs on demand: "Run now" in /integrations/trigger (sent only when trigger.dev is active). */
export const leadIntelRunAll = task({
  id: 'lead-intel-run-all',
  run: startDailyLeadJobs,
})
