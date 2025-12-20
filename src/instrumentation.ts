/**
 * Next.js Instrumentation
 * Runs once when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate environment variables on startup
    const { validateServerEnv } = await import('@/lib/env');

    try {
      validateServerEnv();
      console.log('Environment variables validated successfully');
    } catch (error) {
      console.error('Failed to validate environment:', error);
      // In production, fail hard. In development, warn but continue.
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
