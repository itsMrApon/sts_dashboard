import { hostname } from 'node:os'
import { connect } from 'inngest/connect'
import { inngest } from './client'
import { jobFunctions } from './functions'

/**
 * The Inngest worker: a long-running process (the `sts-jobs-worker` container, built from the app
 * image) that opens an outbound connection to Inngest and runs the jobs in src/inngest/functions.
 * Nothing calls in through Cloudflare, so long jobs are not cut at the tunnel's ~100 s limit.
 *
 * Without INNGEST_SIGNING_KEY (and not in dev) it waits idle instead of crash-looping, so the
 * container can be deployed before Inngest is set up.
 */
async function main() {
  const dev = process.env.INNGEST_DEV === '1'
  if (!dev && !process.env.INNGEST_SIGNING_KEY?.trim()) {
    console.log('[jobs-worker] INNGEST_SIGNING_KEY is not set: idle. Add it to .env.production and redeploy the worker.')
    setInterval(() => undefined, 1 << 30)
    return
  }
  const connection = await connect({
    apps: [{ client: inngest, functions: jobFunctions }],
    instanceId: process.env.INNGEST_CONNECT_INSTANCE_ID || `sts-jobs-${hostname()}`,
    // The free plan runs 5 steps at once; more here would only queue.
    maxWorkerConcurrency: 5,
  })
  console.log(`[jobs-worker] connected to Inngest${dev ? ' (dev server)' : ''} with ${jobFunctions.length} functions`)
  await connection.closed
  console.log('[jobs-worker] connection closed')
}

main().catch((error) => {
  console.error('[jobs-worker] failed to start', error)
  process.exit(1)
})
