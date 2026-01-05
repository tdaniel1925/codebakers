import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { trialFingerprints } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { handleApiError } from '@/lib/api-utils';
import { getClientIp, checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const extendTrialSchema = z.object({
  trialId: z.string().uuid(),
  githubCode: z.string().min(1),
});

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
}

/**
 * Exchange GitHub OAuth code for access token
 */
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

/**
 * Get GitHub user info from access token
 */
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

  // Try to get email if not public
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

  return {
    id: user.id,
    login: user.login,
    email,
  };
}

/**
 * POST /api/trial/extend
 * Extend trial by 7 days using GitHub OAuth
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP (stricter for extend)
    const ip = getClientIp(req.headers);
    checkRateLimit(`trial:extend:${ip}`, { windowMs: 60 * 60 * 1000, maxRequests: 10 }); // 10 per hour

    const body = await req.json();
    const { trialId, githubCode } = extendTrialSchema.parse(body);

    // Find the trial
    const trial = await db.query.trialFingerprints.findFirst({
      where: eq(trialFingerprints.id, trialId),
    });

    if (!trial) {
      return NextResponse.json(
        { error: 'Trial not found' },
        { status: 404 }
      );
    }

    // Check if already extended
    if (trial.trialStage === 'extended') {
      return NextResponse.json(
        {
          error: 'already_extended',
          message: 'Trial has already been extended. Upgrade to continue.',
        },
        { status: 400 }
      );
    }

    // Check if converted
    if (trial.trialStage === 'converted') {
      return NextResponse.json(
        {
          error: 'already_converted',
          message: 'You already have a paid account.',
        },
        { status: 400 }
      );
    }

    // Exchange GitHub code for token
    const accessToken = await exchangeGitHubCode(githubCode);
    const githubUser = await getGitHubUser(accessToken);

    // Check if GitHub account already used for another trial
    const existingGithub = await db.query.trialFingerprints.findFirst({
      where: and(
        eq(trialFingerprints.githubId, githubUser.id.toString()),
        ne(trialFingerprints.id, trialId)
      ),
    });

    if (existingGithub) {
      return NextResponse.json(
        {
          error: 'github_already_used',
          message: 'This GitHub account has already been used for a trial. Please upgrade to continue.',
        },
        { status: 403 }
      );
    }

    // Extend trial by 14 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const [updated] = await db.update(trialFingerprints)
      .set({
        githubId: githubUser.id.toString(),
        githubUsername: githubUser.login,
        email: githubUser.email,
        trialStage: 'extended',
        trialExtendedAt: new Date(),
        trialExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(trialFingerprints.id, trialId))
      .returning();

    return NextResponse.json({
      trialId: updated.id,
      stage: 'extended',
      expiresAt: updated.trialExpiresAt?.toISOString(),
      daysRemaining: 14,
      githubUsername: updated.githubUsername,
    });

  } catch (error) {
    // Handle GitHub OAuth specific errors
    if (error instanceof Error && error.message.includes('bad_verification_code')) {
      return NextResponse.json(
        {
          error: 'invalid_code',
          message: 'GitHub authorization expired. Please try again.',
        },
        { status: 400 }
      );
    }

    return handleApiError(error);
  }
}
