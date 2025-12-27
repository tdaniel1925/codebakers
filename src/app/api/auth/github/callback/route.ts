import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trialFingerprints } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

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
 * Handle GitHub OAuth callback for trial extension
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // trial ID
  const error = searchParams.get('error');

  // Handle GitHub errors
  if (error) {
    return new NextResponse(renderErrorPage('Authorization was denied.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code || !state) {
    return new NextResponse(renderErrorPage('Missing authorization code.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    // Find the trial
    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.id, state),
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

    // Exchange code for token
    const accessToken = await exchangeGitHubCode(code);
    const githubUser = await getGitHubUser(accessToken);

    // Check if GitHub account already used
    const existingGithub = await db.query.trialFingerprints.findFirst({
      where: and(
        eq(trialFingerprints.githubId, githubUser.id.toString()),
        ne(trialFingerprints.id, state)
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
      .where(eq(trialFingerprints.id, state));

    return new NextResponse(renderSuccessPage(githubUser.login), {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse(renderErrorPage(message), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
