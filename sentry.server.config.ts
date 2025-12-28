import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Set environment
  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Set sampling rate for profiling
  profilesSampleRate: 1.0,

  // Capture API route errors
  beforeSend(event, hint) {
    // Filter out expected errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Don't report 404s or validation errors
      if (
        error.message.includes('404') ||
        error.message.includes('Not found') ||
        error.message.includes('Validation failed')
      ) {
        return null;
      }
    }
    return event;
  },
});
