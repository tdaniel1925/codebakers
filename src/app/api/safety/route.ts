import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, autoRateLimit } from '@/lib/api-utils';
import { ContextLoaderService, ContextCache } from '@/services/context-loader-service';
import { ScoperAgentService, ScopingCache } from '@/services/scoper-agent-service';
import { ScopeLockService, ScopeLockCache } from '@/services/scope-lock-service';
import { DecisionLogService, DecisionCache } from '@/services/decision-log-service';
import { AttemptTrackerService, AttemptCache } from '@/services/attempt-tracker-service';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/safety
 * Main safety system endpoint - handles all safety operations
 *
 * Body: {
 *   action: 'load_context' | 'clarify_intent' | 'answer_clarification' |
 *           'define_scope' | 'check_action' | 'log_attempt' | 'log_decision' |
 *           'get_status',
 *   sessionId?: string,  // Required for most actions (except load_context which creates one)
 *   ...actionSpecificParams
 * }
 */
export async function POST(req: NextRequest) {
  try {
    autoRateLimit(req);

    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'action is required and must be a string' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'load_context':
        return handleLoadContext(body);

      case 'clarify_intent':
        return handleClarifyIntent(body);

      case 'answer_clarification':
        return handleAnswerClarification(body);

      case 'define_scope':
        return handleDefineScope(body);

      case 'check_action':
        return handleCheckAction(body);

      case 'log_attempt':
        return handleLogAttempt(body);

      case 'log_decision':
        return handleLogDecision(body);

      case 'get_status':
        return handleGetStatus(body);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Load project context from .codebakers/ files
 */
async function handleLoadContext(body: {
  stateJson?: string;
  decisions?: string;
  devlog?: string;
  attempts?: string;
  blocked?: string;
}) {
  const sessionId = `safety_${randomUUID().slice(0, 8)}`;

  // Load context from provided content strings
  const context = ContextLoaderService.loadContextFromContent({
    stateJson: body.stateJson,
    decisionsContent: body.decisions,
    devlogContent: body.devlog,
    attemptsContent: body.attempts,
    blockedContent: body.blocked,
  });

  // Cache the context
  ContextCache.set(sessionId, context);

  // Also cache decisions and attempts for quick lookup
  DecisionCache.set(sessionId, context.decisions);
  AttemptCache.clear(sessionId);
  context.recentAttempts.forEach((a) => AttemptCache.add(sessionId, a));

  const summary = ContextLoaderService.formatContextForPrompt(context);

  return NextResponse.json({
    success: true,
    sessionId,
    context: {
      hasDecisions: context.decisions.length > 0,
      decisionCount: context.decisions.length,
      hasBlockers: context.blockers.length > 0,
      blockerCount: context.blockers.length,
      recentAttemptCount: context.recentAttempts.length,
      failedAttemptCount: context.recentAttempts.filter((a) => a.result === 'failure').length,
    },
    summary,
    message: context.decisions.length > 0 || context.blockers.length > 0
      ? 'Context loaded. Review the summary before proceeding.'
      : 'No existing context found. This appears to be a fresh session.',
  });
}

/**
 * Analyze user intent with confidence scoring
 */
async function handleClarifyIntent(body: {
  sessionId: string;
  userInput: string;
}) {
  if (!body.sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required. Call load_context first.' },
      { status: 400 }
    );
  }

  if (!body.userInput) {
    return NextResponse.json(
      { error: 'userInput is required' },
      { status: 400 }
    );
  }

  const result = await ScoperAgentService.analyzeIntent(body.userInput);

  // Cache the scoping session
  ScopingCache.create(body.sessionId, body.userInput, result.scores);

  return NextResponse.json({
    success: true,
    sessionId: body.sessionId,
    overallConfidence: result.overallConfidence,
    readyToProceed: result.readyToProceed,
    scores: result.scores.map(s => ({
      field: s.field,
      value: s.value,
      confidence: s.confidence,
      needsClarification: s.needsClarification,
    })),
    clarificationQuestions: result.clarificationQuestions,
    message: result.readyToProceed
      ? 'Intent is clear. You may proceed with implementation.'
      : `Need clarification on ${result.clarificationQuestions.length} question(s) before proceeding.`,
  });
}

/**
 * Process user's answer to a clarification question
 */
async function handleAnswerClarification(body: {
  sessionId: string;
  questionId: string;
  answer: string;
}) {
  if (!body.sessionId || !body.questionId || !body.answer) {
    return NextResponse.json(
      { error: 'sessionId, questionId, and answer are required' },
      { status: 400 }
    );
  }

  const session = ScopingCache.get(body.sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found. Call clarify_intent first.' },
      { status: 404 }
    );
  }

  const result = await ScoperAgentService.processAnswer(
    session.scores,
    body.questionId,
    body.answer
  );

  // Update cache
  ScopingCache.updateScores(body.sessionId, result.scores);
  ScopingCache.addQuestion(body.sessionId, body.questionId);

  return NextResponse.json({
    success: true,
    sessionId: body.sessionId,
    overallConfidence: result.overallConfidence,
    readyToProceed: result.readyToProceed,
    remainingQuestions: result.clarificationQuestions.length,
    clarificationQuestions: result.clarificationQuestions,
    message: result.readyToProceed
      ? 'All required information gathered. You may proceed.'
      : `Still need ${result.clarificationQuestions.filter(q => q.required).length} required answer(s).`,
  });
}

/**
 * Define scope lock for the task
 */
async function handleDefineScope(body: {
  sessionId: string;
  userRequest: string;
  allowedFiles?: string[];
  allowedDirectories?: string[];
  forbiddenFiles?: string[];
}) {
  if (!body.sessionId || !body.userRequest) {
    return NextResponse.json(
      { error: 'sessionId and userRequest are required' },
      { status: 400 }
    );
  }

  const scopeLock = ScopeLockService.createScopeLock({
    userRequest: body.userRequest,
    inferredScope: {
      allowedFiles: body.allowedFiles,
      allowedDirectories: body.allowedDirectories,
      forbiddenFiles: body.forbiddenFiles,
    },
  });

  // Cache the scope lock
  ScopeLockCache.set(body.sessionId, scopeLock);

  return NextResponse.json({
    success: true,
    sessionId: body.sessionId,
    scopeLock: {
      id: scopeLock.id,
      allowedActions: scopeLock.allowedActions,
      allowedDirectories: scopeLock.allowedDirectories,
      forbiddenFiles: scopeLock.forbiddenFiles,
      maxNewFiles: scopeLock.maxNewFiles,
      maxModifiedFiles: scopeLock.maxModifiedFiles,
      canDeleteFiles: scopeLock.canDeleteFiles,
      canModifyPackageJson: scopeLock.canModifyPackageJson,
      canModifySchema: scopeLock.canModifySchema,
    },
    display: ScopeLockService.formatForDisplay(scopeLock),
    message: 'Scope locked. Any action outside this scope will be flagged.',
  });
}

/**
 * Check if an action is allowed
 */
async function handleCheckAction(body: {
  sessionId: string;
  actionType: string;
  targetFile: string;
  details?: string;
}) {
  if (!body.sessionId || !body.actionType || !body.targetFile) {
    return NextResponse.json(
      { error: 'sessionId, actionType, and targetFile are required' },
      { status: 400 }
    );
  }

  const scopeLock = ScopeLockCache.get(body.sessionId);
  if (!scopeLock) {
    return NextResponse.json({
      success: true,
      allowed: true,
      reason: 'No scope lock defined. Action permitted by default.',
      warning: 'Consider calling define_scope to prevent scope creep.',
    });
  }

  const result = ScopeLockService.checkAction(scopeLock, {
    type: body.actionType as Parameters<typeof ScopeLockService.checkAction>[1]['type'],
    targetFile: body.targetFile,
    details: body.details,
  });

  if (result.violation) {
    ScopeLockCache.addViolation(body.sessionId, result.violation);
  }

  // Also check for contradictions with existing decisions
  const decisions = DecisionCache.get(body.sessionId);
  const contradiction = ScopeLockService.checkContradiction(
    `${body.actionType} on ${body.targetFile}`,
    decisions
  );

  return NextResponse.json({
    success: true,
    allowed: result.allowed,
    reason: result.reason,
    violation: result.violation,
    contradiction: contradiction ? {
      severity: contradiction.severity,
      explanation: contradiction.explanation,
      conflictingDecision: contradiction.conflictingDecision.decision,
    } : null,
  });
}

/**
 * Log an attempt
 */
async function handleLogAttempt(body: {
  sessionId: string;
  issue: string;
  approach: string;
  codeOrCommand: string;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
  lessonsLearned?: string;
}) {
  if (!body.sessionId || !body.issue || !body.approach || !body.result) {
    return NextResponse.json(
      { error: 'sessionId, issue, approach, and result are required' },
      { status: 400 }
    );
  }

  const attempt = AttemptTrackerService.createAttempt({
    issue: body.issue,
    approach: body.approach,
    codeOrCommand: body.codeOrCommand || '',
    result: body.result,
    errorMessage: body.errorMessage,
    lessonsLearned: body.lessonsLearned,
  });

  AttemptCache.add(body.sessionId, attempt);

  // Check if this approach was already tried
  const allAttempts = AttemptCache.get(body.sessionId);
  const previousCheck = AttemptTrackerService.hasBeenTried(
    body.issue,
    body.approach,
    allAttempts.slice(0, -1) // Exclude the one we just added
  );

  return NextResponse.json({
    success: true,
    attemptId: attempt.id,
    logged: true,
    wasAlreadyTried: previousCheck.alreadyTried,
    recommendation: previousCheck.recommendation,
    message: body.result === 'failure'
      ? 'Failure logged. This approach will be flagged if attempted again.'
      : 'Attempt logged successfully.',
  });
}

/**
 * Log a decision
 */
async function handleLogDecision(body: {
  sessionId: string;
  decision: string;
  category: string;
  reasoning: string;
  alternativesConsidered?: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  relatedFiles?: string[];
}) {
  if (!body.sessionId || !body.decision || !body.reasoning || !body.impact) {
    return NextResponse.json(
      { error: 'sessionId, decision, reasoning, and impact are required' },
      { status: 400 }
    );
  }

  const decision = DecisionLogService.createDecision({
    decision: body.decision,
    category: (body.category || 'business-logic') as Parameters<typeof DecisionLogService.createDecision>[0]['category'],
    reasoning: body.reasoning,
    alternativesConsidered: body.alternativesConsidered,
    madeBy: 'ai',
    userApproved: false,
    impact: body.impact,
    relatedFiles: body.relatedFiles,
  });

  DecisionCache.add(body.sessionId, decision);

  // Check for contradictions
  const allDecisions = DecisionCache.get(body.sessionId);
  const contradiction = DecisionLogService.checkContradiction(
    body.decision,
    allDecisions.slice(0, -1) // Exclude the one we just added
  );

  return NextResponse.json({
    success: true,
    decisionId: decision.id,
    logged: true,
    hasContradiction: contradiction.hasContradiction,
    contradictionExplanation: contradiction.explanation,
    markdown: DecisionLogService.formatDecisionForMarkdown(decision),
    message: contradiction.hasContradiction
      ? `Decision logged but contradicts: ${contradiction.conflictingDecision?.decision}`
      : 'Decision logged successfully.',
  });
}

/**
 * Get current safety status
 */
async function handleGetStatus(body: { sessionId: string }) {
  if (!body.sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  const context = ContextCache.get(body.sessionId);
  const scopingSession = ScopingCache.get(body.sessionId);
  const scopeLock = ScopeLockCache.get(body.sessionId);
  const decisions = DecisionCache.get(body.sessionId);
  const attempts = AttemptCache.get(body.sessionId);

  const gates = {
    contextLoaded: !!context,
    intentClarified: scopingSession?.confirmed || false,
    scopeLocked: ScopeLockCache.isActive(body.sessionId),
  };

  const safetyScore = (
    (gates.contextLoaded ? 25 : 0) +
    (gates.intentClarified ? 25 : 0) +
    (gates.scopeLocked ? 25 : 0) +
    25 // Base score for having a session
  );

  return NextResponse.json({
    success: true,
    sessionId: body.sessionId,
    gates,
    safetyScore,
    stats: {
      decisionsLogged: decisions.length,
      attemptsLogged: attempts.length,
      failedAttempts: attempts.filter(a => a.result === 'failure').length,
      scopeViolations: scopeLock?.violations.length || 0,
    },
    scopeLock: scopeLock ? {
      id: scopeLock.id,
      allowedActions: scopeLock.allowedActions,
      violations: scopeLock.violations.length,
    } : null,
  });
}

/**
 * GET /api/safety?sessionId=xxx
 * Quick status check
 */
export async function GET(req: NextRequest) {
  try {
    autoRateLimit(req);

    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400 }
      );
    }

    return handleGetStatus({ sessionId });
  } catch (error) {
    return handleApiError(error);
  }
}
