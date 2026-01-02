import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/github/trial?device_hash=xxx
 * Redirect to GitHub OAuth for trial creation
 *
 * This is the new flow that requires GitHub auth to START a trial
 * (not just extend). Prevents trial abuse across devices.
 */
export async function GET(req: NextRequest) {
  // Rate limit by IP to prevent abuse
  const ip = getClientIp(req.headers);
  try {
    checkRateLimit(`github:trial:${ip}`, { windowMs: 60 * 1000, maxRequests: 10 });
  } catch {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const deviceHash = searchParams.get('device_hash');

  if (!deviceHash) {
    logger.warn('GitHub trial OAuth: Missing device_hash parameter');
    return NextResponse.json(
      { error: 'Missing device_hash parameter' },
      { status: 400 }
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    logger.error('GitHub trial OAuth: GITHUB_CLIENT_ID not configured');
    return NextResponse.json(
      { error: 'GitHub OAuth not configured' },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://codebakers.ai';
  const redirectUri = `${appUrl}/api/auth/github/callback`;

  // Encode state as JSON with type and deviceHash
  // This tells the callback handler to create a trial (not extend)
  const state = JSON.stringify({
    type: 'trial_start',
    deviceHash,
  });

  // Base64 encode to make URL-safe
  const encodedState = Buffer.from(state).toString('base64url');

  // Build GitHub OAuth URL
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', encodedState);

  logger.info('GitHub trial OAuth: Redirecting to GitHub', { deviceHash: deviceHash.slice(0, 8) + '...' });

  return NextResponse.redirect(authUrl.toString());
}
