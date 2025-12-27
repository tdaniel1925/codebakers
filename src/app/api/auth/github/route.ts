import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/github?trial_id=xxx
 * Redirect to GitHub OAuth for trial extension
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trialId = searchParams.get('trial_id');

  if (!trialId) {
    return NextResponse.json(
      { error: 'Missing trial_id parameter' },
      { status: 400 }
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth not configured' },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://codebakers.ai';
  const redirectUri = `${appUrl}/api/auth/github/callback`;

  // Build GitHub OAuth URL
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', trialId); // Pass trial ID through state

  return NextResponse.redirect(authUrl.toString());
}
