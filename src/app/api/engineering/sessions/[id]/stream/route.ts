import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { engineeringSessions, engineeringMessages, teamMembers } from '@/db/schema';
import { eq, desc, gt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineering/sessions/[id]/stream
 * Server-Sent Events stream for real-time build updates
 *
 * ZERO FRICTION: UI automatically updates as build progresses
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify team access
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  const teamIds = userTeams.map((t) => t.teamId).filter((tid): tid is string => tid !== null);

  // Get the session
  const [record] = await db
    .select()
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, id))
    .limit(1);

  if (!record || !teamIds.includes(record.teamId)) {
    return new Response('Not found', { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let lastMessageId: string | null = null;
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      const initialData = await getSessionState(id);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

      // Poll for updates every 2 seconds
      const interval = setInterval(async () => {
        if (!isActive) {
          clearInterval(interval);
          return;
        }

        try {
          const state = await getSessionState(id);

          // Get new messages since last check
          const newMessages = await getNewMessages(id, lastMessageId);
          if (newMessages.length > 0) {
            lastMessageId = newMessages[newMessages.length - 1].id;
            state.newMessages = newMessages;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));

          // Stop polling if build is complete or paused
          if (state.status === 'completed' || state.status === 'abandoned') {
            isActive = false;
            clearInterval(interval);
            controller.close();
          }
        } catch (error) {
          console.error('Stream error:', error);
          isActive = false;
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(interval);
      });
    },
    cancel() {
      isActive = false;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

interface SessionState {
  id: string;
  status: string;
  currentPhase: string;
  currentAgent: string;
  isRunning: boolean;
  progress: number;
  phases: Array<{
    phase: string;
    status: string;
    passedAt?: Date | null;
  }>;
  artifacts: {
    hasPrd: boolean;
    hasTechSpec: boolean;
    hasSecurityAudit: boolean;
  };
  lastError?: string | null;
  totalApiCalls: number;
  totalTokensUsed: number;
  newMessages?: Array<{
    id: string;
    fromAgent: string;
    messageType: string;
    content: string;
    createdAt: Date | null;
  }>;
}

async function getSessionState(sessionId: string): Promise<SessionState> {
  const [record] = await db
    .select()
    .from(engineeringSessions)
    .where(eq(engineeringSessions.id, sessionId))
    .limit(1);

  if (!record) {
    throw new Error('Session not found');
  }

  const gateStatus = record.gateStatus ? JSON.parse(record.gateStatus) : {};
  const artifacts = record.artifacts ? JSON.parse(record.artifacts) : {};

  // Calculate progress
  const phases = [
    'scoping', 'requirements', 'architecture', 'design_review', 'implementation',
    'code_review', 'testing', 'security_review', 'documentation', 'staging', 'launch'
  ];
  const completedPhases = phases.filter(p => gateStatus[p]?.status === 'passed').length;
  const progress = Math.round((completedPhases / phases.length) * 100);

  return {
    id: record.id,
    status: record.status || 'active',
    currentPhase: record.currentPhase || 'scoping',
    currentAgent: record.currentAgent || 'orchestrator',
    isRunning: record.isRunning ?? false,
    progress,
    phases: phases.map(p => ({
      phase: p,
      status: gateStatus[p]?.status || 'pending',
      passedAt: gateStatus[p]?.passedAt || null,
    })),
    artifacts: {
      hasPrd: !!artifacts.prd,
      hasTechSpec: !!artifacts.techSpec,
      hasSecurityAudit: !!artifacts.securityAudit,
    },
    lastError: record.lastError,
    totalApiCalls: record.totalApiCalls || 0,
    totalTokensUsed: record.totalTokensUsed || 0,
  };
}

async function getNewMessages(
  sessionId: string,
  afterId: string | null
): Promise<Array<{
  id: string;
  fromAgent: string;
  messageType: string;
  content: string;
  createdAt: Date | null;
}>> {
  let query = db
    .select({
      id: engineeringMessages.id,
      fromAgent: engineeringMessages.fromAgent,
      messageType: engineeringMessages.messageType,
      content: engineeringMessages.content,
      createdAt: engineeringMessages.createdAt,
    })
    .from(engineeringMessages)
    .where(eq(engineeringMessages.sessionId, sessionId))
    .orderBy(desc(engineeringMessages.createdAt))
    .limit(10);

  const messages = await query;

  // Filter messages after the given ID if provided
  if (afterId) {
    const afterIndex = messages.findIndex(m => m.id === afterId);
    if (afterIndex > 0) {
      return messages.slice(0, afterIndex).reverse();
    }
    return [];
  }

  return messages.reverse();
}
