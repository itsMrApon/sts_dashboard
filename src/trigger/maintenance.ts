import { logger, schedules } from '@trigger.dev/sdk'
import { cleanupOldRows, expirePaymentRequests, sendMorningSummaries, sendWebinarReminders } from '@/lib/jobs/maintenance'
import { runReviewRequests } from '@/lib/reviews/reviewRequests'

/** The app's public address, for links in emails and Telegram (set in the trigger.dev env). */
function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
}

/** Every 15 minutes: webinar reminders a day and an hour before. */
export const webinarReminders = schedules.task({
  id: 'webinar-reminders',
  cron: '*/15 * * * *',
  run: async () => sendWebinarReminders(appUrl()),
})

/** Daily 01:30 UTC (07:30 in Dhaka), after the lead jobs: each creator's morning summary on Telegram. */
export const morningSummary = schedules.task({
  id: 'morning-summary',
  cron: '30 1 * * *',
  run: async () => sendMorningSummaries(appUrl()),
})

/** Daily 15:00 UTC: review links for buyers who paid a few days ago (creators who opted in). */
export const reviewRequestsDaily = schedules.task({
  id: 'review-requests-daily',
  cron: '0 15 * * *',
  run: async () => {
    const summary = await runReviewRequests(appUrl())
    if (summary.errors.length > 0) logger.warn('Some review requests failed', { errors: summary.errors })
    return summary
  },
})

/** Daily 03:00 UTC: expire unpaid payment requests and clean up old rows. */
export const dailyCleanup = schedules.task({
  id: 'daily-cleanup',
  cron: '0 3 * * *',
  run: async () => ({ ...(await expirePaymentRequests()), ...(await cleanupOldRows()) }),
})
