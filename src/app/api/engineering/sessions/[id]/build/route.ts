import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError, successResponse, autoRateLimit, ValidationError, NotFoundError, ForbiddenError } from '@/lib/api-utils';
import { db } from '@/db';
import { engineeringSessions, teamMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { runAutoBuild } from '@/services/engineering-agent-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineering/sessions/[id]/build
 * Start the automated build process
 *
 * ZERO FRICTION: User just clicks "Build" and everything happens automatically
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    const authSession = await requireAuth();
    const userId = authSession.user.id;
    const { id } = await params;

    // Get user's teams to verify access
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId).filter((tid): tid is string => tid !== null);

    if (teamIds.length === 0) {
      throw new ForbiddenError('No team access');
    }

    // Get the session
    const [record] = await db
      .select()
      .from(engineeringSessions)
      .where(eq(engineeringSessions.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Session not found');
    }

    // Verify user has access to this session's team
    if (!teamIds.includes(record.teamId)) {
      throw new ForbiddenError('Access denied to this session');
    }

    // Check if already running
    if (record.isRunning) {
      throw new ValidationError('Build is already running');
    }

    // Check if completed
    if (record.status === 'completed') {
      throw new ValidationError('Build is already completed');
    }

    // Start the auto-build in the background (non-blocking)
    // The build will run asynchronously and update the database
    runAutoBuild(id).catch(error => {
      console.error(`Background build error for session ${id}:`, error);
    });

    return successResponse({
      message: 'Build started',
      sessionId: id,
      status: 'running',
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/engineering/sessions/[id]/build
 * Stop/pause the automated build process
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    autoRateLimit(req);
    const authSession = await requireAuth();
    const userId = authSession.user.id;
    const { id } = await params;

    // Get user's teams to verify access
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId).filter((tid): tid is string => tid !== null);

    if (teamIds.length === 0) {
      throw new ForbiddenError('No team access');
    }

    // Get the session
    const [record] = await db
      .select()
      .from(engineeringSessions)
      .where(eq(engineeringSessions.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundError('Session not found');
    }

    // Verify user has access to this session's team
    if (!teamIds.includes(record.teamId)) {
      throw new ForbiddenError('Access denied to this session');
    }

    // Check if running
    if (!record.isRunning) {
      throw new ValidationError('Build is not running');
    }

    // Stop the build by setting isRunning to false
    // The background process will check this and stop
    await db
      .update(engineeringSessions)
      .set({
        isRunning: false,
        status: 'paused',
        pausedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(engineeringSessions.id, id));

    return successResponse({
      message: 'Build paused',
      sessionId: id,
      status: 'paused',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
