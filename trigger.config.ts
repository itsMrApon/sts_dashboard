import { defineConfig } from '@trigger.dev/sdk'
import { prismaExtension } from '@trigger.dev/build/extensions/prisma'

/**
 * Background jobs (src/trigger). Runs on trigger.dev Cloud for now; the same config works on a
 * self-hosted trigger.dev later. The project ref is not secret; TRIGGER_PROJECT_REF overrides it
 * (for example a self-hosted project). The app needs TRIGGER_SECRET_KEY to start jobs.
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF || 'proj_ifpnxpxhevvcomtohwnv',
  dirs: ['./src/trigger'],
  // Calendar sync, scoring and research call slow outside APIs; give each run room.
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 2, minTimeoutInMs: 5_000, maxTimeoutInMs: 60_000, factor: 2 },
  },
  build: {
    // Shared lib files import 'server-only'; this condition makes that import a no-op here.
    conditions: ['react-server'],
    extensions: [prismaExtension({ mode: 'legacy', schema: 'prisma/schema.prisma' })],
  },
})
