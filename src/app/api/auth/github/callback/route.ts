import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trialFingerprints } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// State types for different OAuth flows
interface TrialStartState {
  type: 'trial_start';
  deviceHash: string;
}

interface TrialExtendState {
  type: 'trial_extend';
  trialId: string;
}

type OAuthState = TrialStartState | TrialExtendState | string; // string = legacy trialId

function parseState(state: string): OAuthState {
  // Try to decode as base64url JSON (new format)
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed.type === 'trial_start' && parsed.deviceHash) {
      return parsed as TrialStartState;
    }
    if (parsed.type === 'trial_extend' && parsed.trialId) {
      return parsed as TrialExtendState;
    }
  } catch {
    // Not JSON, treat as legacy trialId
  }
  // Legacy format: state is just the trialId
  return state;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
}

async function exchangeGitHubCode(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange GitHub code');
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data.access_token;
}

async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeBakers-CLI',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get GitHub user info');
  }

  const user = await response.json();

  let email = user.email;
  if (!email) {
    try {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeBakers-CLI',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: { primary: boolean }) => e.primary);
        email = primaryEmail?.email || emails[0]?.email;
      }
    } catch {
      // Ignore email fetch errors
    }
  }

  return { id: user.id, login: user.login, email };
}

function renderTrialStartedPage(username: string, expiresAt: Date | null): string {
  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : '7 days from now';

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Trial Started - CodeBakers</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 500px;
    }
    .icon { font-size: 80px; margin-bottom: 24px; }
    h1 { font-size: 28px; margin-bottom: 16px; }
    p { color: #a0aec0; line-height: 1.6; margin-bottom: 24px; }
    .username { color: #68d391; font-weight: 600; }
    .expiry { color: #90cdf4; font-weight: 500; }
    .close-note { margin-top: 32px; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#x1F680;</div>
    <h1>Trial Started!</h1>
    <p>
      Welcome, <span class="username">@${username}</span>!<br>
      Your CodeBakers trial is active until <span class="expiry">${expiryDate}</span>.
    </p>
    <p class="timer">You can close this window and return to your terminal.</p>
    <p class="close-note">This window will close automatically in 5 seconds...</p>
  </div>
  <script>
    setTimeout(() => { window.close(); }, 5000);
  </script>
</body>
</html>`;
}

function renderSuccessPage(username: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Trial Extended - CodeBakers</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 500px;
    }
    .icon { font-size: 80px; margin-bottom: 24px; }
    h1 { font-size: 28px; margin-bottom: 16px; }
    p { color: #a0aec0; line-height: 1.6; margin-bottom: 24px; }
    .username { color: #68d391; font-weight: 600; }
    .timer { color: #718096; font-size: 14px; }
    .close-note { margin-top: 32px; color: #718096; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#x1F389;</div>
    <h1>Trial Extended!</h1>
    <p>
      Welcome, <span class="username">@${username}</span>!<br>
      Your CodeBakers trial has been extended by 7 days.
    </p>
    <p class="timer">You can close this window and return to your terminal.</p>
    <p class="close-note">This window will close automatically in 5 seconds...</p>
  </div>
  <script>
    setTimeout(() => { window.close(); }, 5000);
  </script>
</body>
</html>`;
}

function renderErrorPage(error: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Error - CodeBakers</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .container { text-align: center; padding: 40px; max-width: 500px; }
    .icon { font-size: 80px; margin-bottom: 24px; }
    h1 { font-size: 28px; margin-bottom: 16px; color: #fc8181; }
    p { color: #a0aec0; line-height: 1.6; }
    .error { background: rgba(252,129,129,0.1); padding: 16px; border-radius: 8px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#x1F61E;</div>
    <h1>Something went wrong</h1>
    <p>We couldn't extend your trial.</p>
    <div class="error">${error}</div>
    <p style="margin-top: 24px; color: #718096; font-size: 14px;">
      Please close this window and try again.
    </p>
  </div>
</body>
</html>`;
}

/**
 * GET /api/auth/github/callback
 * Handle GitHub OAuth callback for trial start or extension
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle GitHub errors
  if (error) {
    return new NextResponse(renderErrorPage('Authorization was denied.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code || !stateParam) {
    return new NextResponse(renderErrorPage('Missing authorization code.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Parse state to determine flow type
  const state = parseState(stateParam);

  try {
    // Exchange code for token (same for both flows)
    const accessToken = await exchangeGitHubCode(code);
    const githubUser = await getGitHubUser(accessToken);

    // Route based on state type
    if (typeof state === 'object' && state.type === 'trial_start') {
      return handleTrialStart(state, githubUser);
    } else {
      // Legacy flow or trial_extend - treat state as trialId
      const trialId = typeof state === 'object' && state.type === 'trial_extend'
        ? state.trialId
        : stateParam;
      return handleTrialExtend(trialId, githubUser);
    }
  } catch (err) {
    logger.error('GitHub OAuth callback error', {}, err instanceof Error ? err : undefined);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(renderErrorPage(message), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * Handle trial START via GitHub OAuth
 * Creates a new trial linked to GitHub account
 */
async function handleTrialStart(
  state: TrialStartState,
  githubUser: GitHubUser
): Promise<NextResponse> {
  const githubId = githubUser.id.toString();

  // Check if this GitHub account already has a trial
  const existingTrial = await db.query.trialFingerprints.findFirst({
    where: eq(trialFingerprints.githubId, githubId),
  });

  if (existingTrial) {
    // Check if trial is expired and eligible for re-activation (30+ days)
    if (existingTrial.trialStage === 'expired' && existingTrial.trialExpiresAt) {
      const expiredAt = new Date(existingTrial.trialExpiresAt);
      const daysSinceExpired = (Date.now() - expiredAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceExpired >= 30) {
        // Allow re-trial - reset the existing record
        logger.info('Resetting expired trial for re-activation', {
          githubId,
          daysSinceExpired: Math.floor(daysSinceExpired),
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.update(trialFingerprints)
          .set({
            deviceHash: state.deviceHash,
            trialStage: 'anonymous',
            trialStartedAt: new Date(),
            trialExpiresAt: expiresAt,
            trialExtendedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(trialFingerprints.id, existingTrial.id));

        return new NextResponse(renderTrialStartedPage(githubUser.login, expiresAt), {
          headers: { 'Content-Type': 'text/html' },
        });
      } else {
        // Too recent to re-trial
        const daysUntilEligible = Math.ceil(30 - daysSinceExpired);
        return new NextResponse(
          renderErrorPage(`Your trial expired recently. You can start a new trial in ${daysUntilEligible} days, or upgrade to a paid plan now.`),
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    }

    // Trial exists and is active, extended, or converted - return existing
    if (existingTrial.trialStage === 'converted') {
      return new NextResponse(
        renderErrorPage('You already have a paid account. Please log in with your API key.'),
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Active or extended trial - update deviceHash and return success
    await db.update(trialFingerprints)
      .set({
        deviceHash: state.deviceHash,
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, existingTrial.id));

    logger.info('Existing trial linked to new device', {
      githubId,
      trialId: existingTrial.id,
    });

    return new NextResponse(
      renderTrialStartedPage(githubUser.login, existingTrial.trialExpiresAt),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // No existing trial - create new one
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [newTrial] = await db.insert(trialFingerprints)
    .values({
      deviceHash: state.deviceHash,
      githubId,
      githubUsername: githubUser.login,
      email: githubUser.email,
      trialStage: 'anonymous',
      trialStartedAt: new Date(),
      trialExpiresAt: expiresAt,
    })
    .returning();

  logger.info('New trial created via GitHub OAuth', {
    trialId: newTrial.id,
    githubId,
    githubUsername: githubUser.login,
  });

  return new NextResponse(renderTrialStartedPage(githubUser.login, expiresAt), {
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Handle trial EXTENSION via GitHub OAuth (existing flow)
 */
async function handleTrialExtend(
  trialId: string,
  githubUser: GitHubUser
): Promise<NextResponse> {
  // Find the trial
  const trial = await db.query.trialFingerprints.findFirst({
    where: eq(trialFingerprints.id, trialId),
  });

  if (!trial) {
    return new NextResponse(renderErrorPage('Trial not found.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Check if already extended
  if (trial.trialStage === 'extended') {
    return new NextResponse(renderErrorPage('Trial has already been extended.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Check if GitHub account already used for another trial
  const existingGithub = await db.query.trialFingerprints.findFirst({
    where: and(
      eq(trialFingerprints.githubId, githubUser.id.toString()),
      ne(trialFingerprints.id, trialId)
    ),
  });

  if (existingGithub) {
    return new NextResponse(
      renderErrorPage('This GitHub account has already been used for a trial.'),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Extend trial by 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.update(trialFingerprints)
    .set({
      githubId: githubUser.id.toString(),
      githubUsername: githubUser.login,
      email: githubUser.email,
      trialStage: 'extended',
      trialExtendedAt: new Date(),
      trialExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(trialFingerprints.id, trialId));

  logger.info('Trial extended via GitHub OAuth', {
    trialId,
    githubId: githubUser.id.toString(),
  });

  return new NextResponse(renderSuccessPage(githubUser.login), {
    headers: { 'Content-Type': 'text/html' },
  });
}
