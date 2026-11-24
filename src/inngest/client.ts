import { Inngest } from 'inngest'

/**
 * The Inngest app for sts-ai's background jobs, the second runner next to trigger.dev (one is
 * active at a time, see lib/jobs/jobProvider). Keys come from the environment:
 * INNGEST_EVENT_KEY (the app sends events) and INNGEST_SIGNING_KEY (the worker connects).
 * INNGEST_DEV=1 talks to a local `inngest-cli dev` server instead of Inngest Cloud.
 */
export const inngest = new Inngest({ id: 'sts-ai' })

/** Events the jobs listen to. */
export const JOB_EVENTS = {
  leadIntelCreator: 'sts/lead-intel.creator',
  mapsBatchCreator: 'sts/maps-batch.creator',
  leadIntelRunAll: 'sts/lead-intel.run-all',
  questionsCreator: 'sts/questions.creator',
  ping: 'sts/jobs.ping',
} as const
