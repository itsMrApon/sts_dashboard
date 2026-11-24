import { inngest, JOB_EVENTS } from './client'
import { isActiveJobProvider, jobsAppUrl, recordInngestPing } from '@/lib/jobs/jobProvider'
import {
  listLeadIntelCreators,
  listMapsBatchCreators,
  runLeadIntelForCreator,
  runMapsBatchForCreator,
  type MapsBatchCreator,
} from '@/lib/leads/leadIntelJobs'
import { listQuestionCreators, runQuestionsForCreator } from '@/lib/questions/collectQuestions'
import { cleanupOldRows, expirePaymentRequests, sendMorningSummaries, sendWebinarReminders } from '@/lib/jobs/maintenance'
import { runReviewRequests } from '@/lib/reviews/reviewRequests'
import { processInstagramQueue } from '@/lib/instagram/campaigns'
import { refreshExpiringInstagramTokens } from '@/lib/instagram/tokenRefresh'

/**
 * The same jobs as src/trigger, for Inngest. Schedules are identical (UTC). Each scheduled job
 * first checks that Inngest is the active runner, so trigger.dev and Inngest never both do it.
 * Jobs without steps count as one Inngest execution per run (the free plan allows 50,000 a
 * month); only the daily fan-outs use steps.
 */

const SKIPPED = { skipped: 'trigger.dev is the active job runner' } as const

async function skippedUnlessInngest() {
  return (await isActiveJobProvider('inngest')) ? null : SKIPPED
}

// Per-creator work, started by the daily schedules (one run per creator, so one slow creator
// never holds up the others). The free plan runs 5 steps at once in total.

const leadIntelForCreator = inngest.createFunction(
  { id: 'lead-intel-creator', concurrency: 3, retries: 1, triggers: [{ event: JOB_EVENTS.leadIntelCreator }] },
  async ({ event, logger }) => {
    const { userId } = event.data as { userId: string }
    const summary = await runLeadIntelForCreator(userId)
    if (summary.errors.length > 0) logger.warn('Some lead jobs failed', { userId, errors: summary.errors })
    return summary
  },
)

const mapsBatchForCreator = inngest.createFunction(
  { id: 'maps-batch-creator', concurrency: 2, retries: 1, triggers: [{ event: JOB_EVENTS.mapsBatchCreator }] },
  async ({ event, logger }) => {
    const creator = event.data as MapsBatchCreator
    const result = await runMapsBatchForCreator(creator)
    if (result.status === 'done' && !result.scrapeAgent) {
      logger.warn('Scrape agent not configured; websites were not scraped', { userId: creator.userId })
    }
    return result
  },
)

const questionsForCreator = inngest.createFunction(
  { id: 'questions-creator', concurrency: 2, retries: 1, triggers: [{ event: JOB_EVENTS.questionsCreator }] },
  async ({ event, logger }) => {
    const { userId } = event.data as { userId: string }
    const summary = await runQuestionsForCreator(userId)
    if (summary.status === 'done' && summary.errors.length > 0) {
      logger.warn('Some question groups failed', { userId, errors: summary.errors })
    }
    return summary
  },
)

type StepTools = { run: <T>(id: string, fn: () => Promise<T>) => Promise<unknown>; sendEvent: (id: string, events: { name: string; data: object }[]) => Promise<unknown> }

/** One event per creator for the lead jobs and the Maps batch. */
async function startDailyLeadJobs(step: StepTools) {
  const [creators, mapsCreators] = (await step.run('list-creators', () =>
    Promise.all([listLeadIntelCreators(), listMapsBatchCreators()]),
  )) as [string[], MapsBatchCreator[]]
  if (creators.length > 0) {
    await step.sendEvent('start-lead-intel', creators.map((userId) => ({ name: JOB_EVENTS.leadIntelCreator, data: { userId } })))
  }
  if (mapsCreators.length > 0) {
    await step.sendEvent('start-maps-batches', mapsCreators.map((creator) => ({ name: JOB_EVENTS.mapsBatchCreator, data: creator })))
  }
  return { creators: creators.length, mapsBatches: mapsCreators.length }
}

const leadIntelDaily = inngest.createFunction(
  { id: 'lead-intel-daily', triggers: [{ cron: '0 1 * * *' }] },
  async ({ step }) => {
    const active = await step.run('check-runner', () => isActiveJobProvider('inngest'))
    if (!active) return SKIPPED
    return startDailyLeadJobs(step as unknown as StepTools)
  },
)

/** "Run now" in Integrations → trigger.dev, when Inngest is the active runner. */
const leadIntelRunAll = inngest.createFunction(
  { id: 'lead-intel-run-all', triggers: [{ event: JOB_EVENTS.leadIntelRunAll }] },
  async ({ step }) => startDailyLeadJobs(step as unknown as StepTools),
)

const questionsWeekly = inngest.createFunction(
  { id: 'questions-weekly', triggers: [{ cron: '0 2 * * 1' }] },
  async ({ step }) => {
    const active = await step.run('check-runner', () => isActiveJobProvider('inngest'))
    if (!active) return SKIPPED
    const creators = await step.run('list-creators', () => listQuestionCreators())
    if (creators.length > 0) {
      await step.sendEvent('start-questions', creators.map((userId) => ({ name: JOB_EVENTS.questionsCreator, data: { userId } })))
    }
    return { creators: creators.length }
  },
)

// Maintenance: no steps, one execution per run.

const webinarReminders = inngest.createFunction(
  { id: 'webinar-reminders', retries: 1, triggers: [{ cron: '*/15 * * * *' }] },
  async () => (await skippedUnlessInngest()) ?? sendWebinarReminders(jobsAppUrl()),
)

const morningSummary = inngest.createFunction(
  { id: 'morning-summary', retries: 1, triggers: [{ cron: '30 1 * * *' }] },
  async () => (await skippedUnlessInngest()) ?? sendMorningSummaries(jobsAppUrl()),
)

const reviewRequestsDaily = inngest.createFunction(
  { id: 'review-requests-daily', retries: 1, triggers: [{ cron: '0 15 * * *' }] },
  async ({ logger }) => {
    const skipped = await skippedUnlessInngest()
    if (skipped) return skipped
    const summary = await runReviewRequests(jobsAppUrl())
    if (summary.errors.length > 0) logger.warn('Some review requests failed', { errors: summary.errors })
    return summary
  },
)

const dailyCleanup = inngest.createFunction(
  { id: 'daily-cleanup', retries: 1, triggers: [{ cron: '0 3 * * *' }] },
  async () => (await skippedUnlessInngest()) ?? { ...(await expirePaymentRequests()), ...(await cleanupOldRows()) },
)

const instagramQueue = inngest.createFunction(
  { id: 'instagram-queue', retries: 0, concurrency: 1, triggers: [{ cron: '*/5 * * * *' }] },
  async () => (await skippedUnlessInngest()) ?? processInstagramQueue(100),
)

const instagramTokenRefresh = inngest.createFunction(
  { id: 'instagram-token-refresh', retries: 1, triggers: [{ cron: '0 4 * * *' }] },
  async () => (await skippedUnlessInngest()) ?? refreshExpiringInstagramTokens(),
)

/** "Test worker" in Integrations: proves the worker is connected and can reach the database. */
const jobsPing = inngest.createFunction(
  { id: 'jobs-ping', retries: 0, triggers: [{ event: JOB_EVENTS.ping }] },
  async () => ({ answeredAt: await recordInngestPing() }),
)

export const jobFunctions = [
  leadIntelForCreator,
  mapsBatchForCreator,
  questionsForCreator,
  leadIntelDaily,
  leadIntelRunAll,
  questionsWeekly,
  webinarReminders,
  morningSummary,
  reviewRequestsDaily,
  dailyCleanup,
  instagramQueue,
  instagramTokenRefresh,
  jobsPing,
]
