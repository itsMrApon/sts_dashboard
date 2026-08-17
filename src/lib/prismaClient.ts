import { PrismaClient } from '@prisma/client'
import { isDevPerfEnabled } from '@/lib/dev/perf'

/**
 * Bump when Prisma model accessors change (e.g. Business → PublishProfile)
 * so the Next.js HMR singleton does not keep a stale client without the new delegates.
 */
const PRISMA_CLIENT_GENERATION = 'provider-usage-v2'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var prismaClientGeneration: string | undefined
}

const createPrismaClient = () =>
  new PrismaClient({
    log: isDevPerfEnabled ? [{ emit: 'event', level: 'query' }] : [],
  })

function resolvePrismaClient(): PrismaClient {
  const cached = globalThis.prisma
  const generationMatches = globalThis.prismaClientGeneration === PRISMA_CLIENT_GENERATION
  const hasExpectedDelegate =
    cached != null && typeof (cached as { publishProfile?: unknown }).publishProfile !== 'undefined'

  if (cached && generationMatches && hasExpectedDelegate) {
    return cached
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined)
  }

  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = client
    globalThis.prismaClientGeneration = PRISMA_CLIENT_GENERATION
  }
  return client
}

export const prismaClient = resolvePrismaClient()
