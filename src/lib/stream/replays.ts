import 'server-only'
import { getStreamClient } from '@/lib/stream/streamClient'

/**
 * The replay of a live session: the latest recording Stream made of its call (the room starts
 * recording when the host goes live). Nothing is copied or stored on our side; Stream's link is
 * fetched fresh each time, since its recording links are signed and expire.
 */
export async function latestReplayUrl(webinarId: string): Promise<string | null> {
  try {
    const { recordings } = await getStreamClient.video.call('livestream', webinarId).listRecordings()
    const latest = [...(recordings ?? [])].sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())[0]
    return latest?.url ?? null
  } catch (error) {
    console.warn('[replay] listRecordings failed', webinarId, error instanceof Error ? error.message : error)
    return null
  }
}
