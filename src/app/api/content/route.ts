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

    // Get project info from headers (sent by CLI)
    const projectId = req.headers.get('x-project-id');
    const projectName = req.headers.get('x-project-name') || 'Unknown Project';

    // Check access: unlimited (paid/beta) OR free trial for same project
    const accessCheck = TeamService.canAccessProject(team, projectId);

    if (!accessCheck.allowed) {
      const isSuspended = accessCheck.code === 'ACCOUNT_SUSPENDED';
      const isProjectLimit = accessCheck.code === 'TRIAL_PROJECT_LIMIT';

      return NextResponse.json(
        {
          error: accessCheck.reason,
          code: accessCheck.code,
          ...(isSuspended && { supportUrl: 'https://codebakers.dev/support' }),
          ...(isProjectLimit && {
            upgradeUrl: 'https://codebakers.dev/billing',
            lockedProject: accessCheck.lockedProjectId,
          }),
        },
        { status: isSuspended ? 403 : 402 }
      );
    }

    // Lock free trial to this project if it's a new project
    if (accessCheck.isNewProject && projectId) {
      await TeamService.setFreeTrialProject(team.id, projectId, projectName);
    }

    // Get encoded content
    const content = await ContentService.getEncodedContent();

    // Include trial info in response
    const trialStatus = TeamService.getTrialStatus(team);

    return NextResponse.json({
      ...content,
      _meta: {
        trialStatus: trialStatus.type,
        ...(trialStatus.type === 'trial_locked' && {
          projectName: trialStatus.projectName,
        }),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
