import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth';
import { TeamService } from '@/services/team-service';
import { handleApiError, successResponse, applyRateLimit, rateLimitConfigs } from '@/lib/api-utils';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/claude/key
 * Returns the Claude API key for authenticated users with active subscriptions.
 * Used by the CodeBakers VS Code extension to make Claude API calls.
 *
 * Authentication methods:
 * - VS Code extension token (base64url JSON)
 * - API key (Bearer cb_xxx)
 * - Session cookie (for dashboard)
 *
 * Pricing: $99/month unlimited
 * - Active subscription = unlimited access
 * - Trial = 14 days free, then requires subscription
 * - Beta users = unlimited access
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthOrApiKey(req);
    console.log('[Claude Key] Auth:', { userId: auth.userId, teamId: auth.teamId, method: auth.authMethod });

    applyRateLimit(req, 'api:claude:key', auth.userId, rateLimitConfigs.apiRead);

    // For all auth methods, verify access from database (not just token)
    // This ensures beta grants and subscription changes take effect immediately
    const team = await TeamService.getById(auth.teamId);

    console.log('[Claude Key] Team:', team ? {
      id: team.id,
      subscriptionStatus: team.subscriptionStatus,
      betaGrantedAt: team.betaGrantedAt,
      freeTrialExpiresAt: team.freeTrialExpiresAt,
    } : 'NOT FOUND');

    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check access: active subscription, beta, or trial
    const hasSubscription = team.subscriptionStatus === 'active';
    const hasBeta = !!team.betaGrantedAt;
    const hasTrial = team.freeTrialExpiresAt && new Date(team.freeTrialExpiresAt) > new Date();
    console.log('[Claude Key] Access check:', { hasSubscription, hasBeta, hasTrial, trialExpiry: team.freeTrialExpiresAt });

    const hasAccess = hasSubscription || hasBeta || hasTrial;

    if (!hasAccess) {
      // No access - return upgrade prompt
      return NextResponse.json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Subscribe to CodeBakers Pro ($99/month) for unlimited AI-powered coding',
        upgradeUrl: 'https://www.codebakers.ai/dashboard/billing',
      }, { status: 402 });
    }

    // Get the Claude API key
    const claudeApiKey = process.env.ANTHROPIC_API_KEY;

    if (!claudeApiKey) {
      throw new Error('Claude API key not configured');
    }

    // Determine status for display
    const status = hasSubscription ? 'pro' : hasBeta ? 'beta' : 'trial';

    // Log usage for analytics
    const username = auth.vsCodePayload?.githubUsername || auth.userId;
    console.log(`[Claude Key] User ${username} - Status: ${status} - Auth: ${auth.authMethod}`);

    return successResponse({
      apiKey: claudeApiKey,
      model: 'claude-sonnet-4-20250514',
      plan: 'pro', // Everyone with access gets full pro features
      unlimited: true,
      // Include trial info if applicable
      ...(hasTrial && !hasSubscription && !hasBeta && {
        trial: {
          endsAt: team.freeTrialExpiresAt,
          daysRemaining: Math.ceil((new Date(team.freeTrialExpiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        }
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
