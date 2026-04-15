import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 *
 * Usage:
 * curl https://your-app.com/api/health
 *
 * Expected Response:
 * 200: {"api":"healthy","database":"healthy","timestamp":"2026-04-05T..."}
 * 503: {"api":"healthy","database":"unhealthy","timestamp":"..."}
 *
 * Monitoring:
 * - Uptime Robot checks this every 5 minutes
 * - Alerts if returns non-200 status
 * - Alerts if response time >5 seconds
 *
 * This endpoint should:
 * 1. Always be fast (<100ms)
 * 2. Check database connectivity
 * 3. Return structured JSON
 * 4. Use appropriate HTTP status codes
 */

export async function GET(req: Request) {
  const startTime = Date.now();

  const health = {
    api: 'healthy' as const,
    database: 'unknown' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    // Don't expose sensitive info
  };

  // Check database connectivity
  try {
    const { prisma } = await import('@/lib/prisma');

    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;

    health.database = 'healthy';
  } catch (error) {
    console.error('Health check - database unreachable:', error);
    health.database = 'unhealthy';

    // Return unhealthy status
    return NextResponse.json(health, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }

  const duration = Date.now() - startTime;

  // Log slow health checks (for monitoring)
  if (duration > 1000) {
    console.warn(`Slow health check: ${duration}ms`);
  }

  // Return healthy status
  return NextResponse.json(
    {
      ...health,
      duration_ms: duration,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    }
  );
}

// Don't allow other methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
