import 'server-only'
import { inngest } from '@/inngest/client'
import { loadInngestStatus } from '@/lib/jobs/jobProvider'

const SEND_TIMEOUT_MS = 15_000

/**
 * Sends one event to Inngest from the app (needs INNGEST_EVENT_KEY, or the local dev server).
 * Server-only on purpose: callers check who is asking first.
 */
export async function sendInngestEvent(name: string, data: Record<string, unknown> = {}): Promise<void> {
  const status = await loadInngestStatus()
  if (!status.canSend) throw new Error('INNGEST_EVENT_KEY is not set on the server.')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      inngest.send({ name, data }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Inngest took too long. Try again.')), SEND_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
