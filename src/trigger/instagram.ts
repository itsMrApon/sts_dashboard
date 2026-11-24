import { schedules } from '@trigger.dev/sdk'
import { processInstagramQueue } from '@/lib/instagram/campaigns'
import { refreshExpiringInstagramTokens } from '@/lib/instagram/tokenRefresh'
import { skippedUnlessTrigger } from './activeProvider'

/** Every 5 minutes: DMs that failed for a moment, or waited for the hourly cap, go out. */
export const instagramQueue = schedules.task({
  id: 'instagram-queue',
  cron: '*/5 * * * *',
  run: async () => (await skippedUnlessTrigger()) ?? processInstagramQueue(100),
})

/** Daily: refresh tokens that expire within 10 days (Instagram tokens last 60 days). */
export const instagramTokenRefresh = schedules.task({
  id: 'instagram-token-refresh',
  cron: '0 4 * * *',
  run: async () => (await skippedUnlessTrigger()) ?? refreshExpiringInstagramTokens(),
})
