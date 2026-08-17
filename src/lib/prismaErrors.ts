/** Prisma codes that mean the DB is unreachable / pool exhausted (often offline network). */
const CONNECTIVITY_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the pool
])

/**
 * Detects DB/network connectivity failures without importing `@prisma/client`
 * (safe for both server actions and client error boundaries).
 */
export function isDatabaseConnectivityError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const code =
      'code' in error && typeof (error as { code: unknown }).code === 'string'
        ? (error as { code: string }).code
        : null
    if (code && CONNECTIVITY_CODES.has(code)) return true

    const name =
      'name' in error && typeof (error as { name: unknown }).name === 'string'
        ? (error as { name: string }).name
        : ''
    if (name === 'PrismaClientInitializationError') return true
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()

  return (
    message.includes("can't reach database server") ||
    message.includes('timed out fetching a new connection') ||
    message.includes('connection pool') ||
    message.includes('server has closed the connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('network error') ||
    message.includes('fetch failed')
  )
}

export const CONNECTION_LOST_MESSAGE =
  'Connection lost. Check your internet and try again.'

/** Log without passing an Error object — Next.js treats console.error(Error) as a red overlay. */
export function logDatabaseConnectivityFailure(scope: string, error: unknown): void {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'unknown'
  const raw =
    error instanceof Error ? error.message : String(error ?? 'unknown')
  const message =
    raw
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) || 'unreachable'
  console.warn(`[${scope}] database unavailable (${code}): ${message}`)
}
