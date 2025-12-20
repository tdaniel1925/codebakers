import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/api-key-service';
import { ContentService } from '@/services/content-service';
import { TeamService } from '@/services/team-service';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const validation = await ApiKeyService.validate(apiKey);

    if (!validation.valid || !validation.team) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { team } = validation;

    // Check access: unlimited (paid/beta) OR free trial with remaining downloads
    const downloadCheck = TeamService.canDownload(team);

    if (!downloadCheck.allowed) {
      const isSuspended = downloadCheck.code === 'ACCOUNT_SUSPENDED';
      return NextResponse.json(
        {
          error: downloadCheck.reason,
          code: downloadCheck.code,
          ...(isSuspended
            ? { supportUrl: 'https://codebakers.dev/support' }
            : { upgradeUrl: 'https://codebakers.dev/billing' }),
        },
        { status: isSuspended ? 403 : 402 } // Forbidden for suspended, Payment Required for trial limit
      );
    }

    // Get encoded content
    const content = await ContentService.getEncodedContent();

    // Increment free downloads counter (only for non-unlimited users)
    if (!TeamService.hasUnlimitedAccess(team)) {
      await TeamService.incrementFreeDownloads(team.id);
    }

    // Include trial info in response for free users
    const trialStatus = TeamService.getTrialStatus(team);

    return NextResponse.json({
      ...content,
      _meta: {
        trialStatus: trialStatus.type,
        ...(trialStatus.type === 'trial' && {
          downloadsUsed: (trialStatus.used ?? 0) + 1, // +1 because we just used one
          downloadsLimit: trialStatus.limit,
          downloadsRemaining: (trialStatus.remaining ?? 1) - 1,
        }),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
