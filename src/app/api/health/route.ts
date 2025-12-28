import { NextRequest, NextResponse } from 'next/server';
import { autoRateLimit } from '@/lib/api-utils';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export async function GET(req: NextRequest) {
  autoRateLimit(req);

  const checks: HealthCheck[] = [];
  let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

  // Database check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.push({
      name: 'database',
      status: 'healthy',
      latencyMs: Date.now() - dbStart,
    });
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    overallStatus = 'unhealthy';
  }

  // Determine HTTP status code (503 for unhealthy, 200 otherwise)
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks,
    },
    { status: httpStatus }
  );
}
