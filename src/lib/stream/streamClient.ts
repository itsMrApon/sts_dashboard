import { StreamClient } from '@stream-io/node-sdk'
import { lazyClient, requireEnv } from '@/lib/lazyClient'

export const getStreamClient = lazyClient(
  () => new StreamClient(requireEnv('NEXT_PUBLIC_STREAM_API_KEY'), requireEnv('STREAM_SECRET')),
)
