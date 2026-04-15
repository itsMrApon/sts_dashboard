import { PrismaClient } from '@prisma/client'
import { isDevPerfEnabled } from '@/lib/dev/perf'

declare global {
  var prisma: PrismaClient | undefined
}

const createPrismaClient = () =>
  new PrismaClient({
    log: isDevPerfEnabled ? [{ emit: 'event', level: 'query' }] : [],
  })

export const prismaClient = globalThis.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prismaClient