import { NextResponse, NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ValidationError, RateLimitError } from './errors';
import {
  checkRateLimit,
  getRateLimitKey,
  getClientIp,
  rateLimitConfigs,
  autoRateLimit,
  type RateLimitConfig,
} from './rate-limit';
import { logger, getRequestId } from './logger';

// Re-export for convenience
export { rateLimitConfigs, autoRateLimit } from './rate-limit';
export { logger, getRequestId } from './logger';

export function handleApiError(error: unknown, requestId?: string): NextResponse {
  const reqId = requestId || 'unknown';

  // Log with structured logging
  if (error instanceof Error) {
    logger.apiError('API Error', reqId, error);
  } else {
    logger.error('API Error', { requestId: reqId, error: String(error) });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    error.issues.forEach((err) => {
      const path = err.path.join('.');
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(err.message);
    });
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details,
      },
      { status: 400 }
    );
  }

  // Handle validation errors
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Handle rate limit errors
  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      {
        status: error.statusCode,
        headers: {
          'Retry-After': error.retryAfter.toString(),
        },
      }
    );
  }

  // Handle known app errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Handle unknown errors
  const message =
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : 'Unknown error'
      : 'Internal server error';

  return NextResponse.json(
    {
      error: message,
      code: 'INTERNAL_ERROR',
      requestId: reqId,
    },
    { status: 500 }
  );
}

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/**
 * Apply rate limiting to a request
 * @param req - The incoming request
 * @param prefix - A prefix for the rate limit key (e.g., 'api:keys')
 * @param userId - Optional user ID (falls back to IP if not provided)
 * @param config - Rate limit config (defaults to api config)
 */
export function applyRateLimit(
  req: NextRequest,
  prefix: string,
  userId?: string | null,
  config: RateLimitConfig = rateLimitConfigs.api
): void {
  const ip = getClientIp(req.headers);
  const key = getRateLimitKey(prefix, userId ?? null, ip);
  checkRateLimit(key, config);
}
