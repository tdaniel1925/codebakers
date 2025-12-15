import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ValidationError, RateLimitError } from './errors';

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    error.errors.forEach((err) => {
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
    },
    { status: 500 }
  );
}

export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}
