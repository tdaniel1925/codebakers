import * as Sentry from '@sentry/nextjs';

/**
 * Next.js Instrumentation
 * Runs once when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Initialize Sentry for server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  // Initialize Sentry for edge runtime
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }

  // Only run env validation on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate environment variables on startup
    const { validateServerEnv } = await import('@/lib/env');
    const { logger } = await import('@/lib/logger');

    try {
      validateServerEnv();
      logger.info('Instrumentation: Environment variables validated successfully');
    } catch (error) {
      logger.error('Instrumentation: Failed to validate environment', { error: error instanceof Error ? error.message : 'Unknown error' });
      Sentry.captureException(error);
      // In production, fail hard. In development, warn but continue.
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}

// Capture unhandled request errors
export const onRequestError = Sentry.captureRequestError;
