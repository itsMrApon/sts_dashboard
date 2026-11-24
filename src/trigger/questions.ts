import { logger, schedules, task } from '@trigger.dev/sdk'
import { listQuestionCreators, runQuestionsForCreator } from '@/lib/questions/collectQuestions'

/** Groups one creator's customer questions. Uses that creator's own Gemini key. */
export const questionsForCreator = task({
  id: 'questions-creator',
  queue: { concurrencyLimit: 3 },
  run: async (payload: { userId: string }) => {
    const summary = await runQuestionsForCreator(payload.userId)
    if (summary.status === 'done' && summary.errors.length > 0) {
      logger.warn('Some question groups failed', { userId: payload.userId, errors: summary.errors })
    }
    return summary
  },
})

/** Every Monday at 02:00 UTC: one run per creator with saved conversations. */
export const questionsWeekly = schedules.task({
  id: 'questions-weekly',
  cron: '0 2 * * 1',
  run: async () => {
    const creators = await listQuestionCreators()
    if (creators.length > 0) {
      await questionsForCreator.batchTrigger(creators.map((userId) => ({ payload: { userId } })))
    }
    logger.info('Started weekly question grouping', { creators: creators.length })
    return { creators: creators.length }
  },
})
