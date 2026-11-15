import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import {
  CONNECTION_LOST_MESSAGE,
  isDatabaseConnectivityError,
  logDatabaseConnectivityFailure,
} from '@/lib/prismaErrors'

type CorsResolver<Args extends unknown[]> = (...args: Args) => HeadersInit | Promise<HeadersInit>

/**
 * Last-resort catch for route handlers: unexpected throws become a JSON error instead of
 * Next's HTML 500. Cross-origin routes pass `corsHeaders` so the browser can read the body
 * (without CORS headers a 500 surfaces in the widget as an opaque "CORS error").
 * Next control-flow throws (redirect, notFound, dynamic-usage bailouts) are rethrown untouched.
 */
export function withRouteErrors<Args extends unknown[]>(
  scope: string,
  handler: (...args: Args) => Promise<Response>,
  options: { corsHeaders?: CorsResolver<Args> } = {},
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      unstable_rethrow(error)

      const unavailable = isDatabaseConnectivityError(error)
      if (unavailable) {
        logDatabaseConnectivityFailure(scope, error)
      } else {
        console.error(`[${scope}] unhandled route error:`, error instanceof Error ? (error.stack ?? error.message) : error)
      }

      let headers: HeadersInit = {}
      if (options.corsHeaders) {
        // CORS lookup usually hits the DB too; if that is what failed, answer without CORS.
        headers = await Promise.resolve(options.corsHeaders(...args)).catch(() => ({}))
      }

      return NextResponse.json(
        unavailable
          ? { error: CONNECTION_LOST_MESSAGE, code: 'SERVICE_UNAVAILABLE' }
          : { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' },
        { status: unavailable ? 503 : 500, headers: { ...headers, 'Cache-Control': 'no-store' } },
      )
    }
  }
}

/** Parses a JSON object body; null for an empty, malformed or non-object body (answer 400, not 500). */
export async function readJsonObject<T extends object>(request: Request): Promise<Partial<T> | null> {
  try {
    const parsed: unknown = await request.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Partial<T>) : null
  } catch {
    return null
  }
}
