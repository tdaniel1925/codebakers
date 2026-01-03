/**
 * SAFETY SYSTEM MCP TOOLS
 *
 * These tools enforce the multi-gate safety system that compensates
 * for AI assistant limitations.
 *
 * MANDATORY TOOLS (must be called in order):
 * 1. load_context - Before any action
 * 2. clarify_intent - For new features/builds
 * 3. check_action - Before making changes
 * 4. log_attempt - After trying fixes
 * 5. log_decision - After significant decisions
 */

import { z } from 'zod';
import { ContextLoaderService } from '@/services/context-loader-service';
import { DecisionLogService, DecisionTemplates } from '@/services/decision-log-service';
import { AttemptTrackerService, AttemptCache } from '@/services/attempt-tracker-service';
import { ScopeLockService, ScopeLockCache } from '@/services/scope-lock-service';
import { ScoperAgentService, ScopingCache } from '@/services/scoper-agent-service';
import { SafetyState, GateStatus, Decision, Attempt } from '@/lib/safety-types';

// =============================================================================
// SAFETY STATE MANAGEMENT
// =============================================================================

const safetyStateCache = new Map<string, SafetyState>();

function getOrCreateSafetyState(sessionId: string, projectHash: string): SafetyState {
  let state = safetyStateCache.get(sessionId);
  if (!state) {
    state = {
      sessionId,
      projectHash,
      gates: {
        contextLoaded: false,
        intentClarified: false,
        contradictionsChecked: false,
        scopeLocked: false,
        patternsLoaded: false,
        implementationStarted: false,
        verificationPassed: false,
        documentationUpdated: false,
      },
      context: null,
      scopeLock: null,
      decisions: [],
      attempts: [],
      contradictions: [],
      checkpoints: [],
      verifications: [],
      currentStep: 0,
      totalSteps: 0,
    };
    safetyStateCache.set(sessionId, state);
  }
  return state;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

/**
 * LOAD CONTEXT TOOL
 *
 * Must be called before any action.
 * Loads all project state, decisions, and history.
 */
export const loadContextTool = {
  name: 'load_context',
  description: `MANDATORY: Load all project context before any action.
This tool loads:
- Project state from .codebakers.json
- Decisions from DECISIONS.md
- Recent attempts from ATTEMPTS.md
- Active blockers from BLOCKED.md
- Recent activity from DEVLOG.md

You CANNOT proceed with discover_patterns or any code generation without calling this first.`,

  inputSchema: z.object({
    projectPath: z.string().optional().describe('Path to project root (optional, uses current directory if not specified)'),
    sessionId: z.string().describe('Session ID for tracking'),
  }),

  handler: async (input: { projectPath?: string; sessionId: string }) => {
    const projectPath = input.projectPath || process.cwd();

    const result = await ContextLoaderService.loadContext(projectPath);

    if (!result.success || !result.context) {
      return {
        success: false,
        error: 'Failed to load context',
        details: result.errors,
        gatesPassed: false,
      };
    }

    // Update safety state
    const state = getOrCreateSafetyState(input.sessionId, result.context.projectName);
    state.context = result.context;
    state.gates.contextLoaded = true;
    state.decisions = result.context.decisions;
    state.attempts = result.context.recentAttempts;

    // Cache the context
    ContextLoaderService.cacheContext(input.sessionId, result.context);

    return {
      success: true,
      context: ContextLoaderService.formatContextForPrompt(result.context),
      warnings: result.warnings,
      gatesPassed: true,
      nextGate: 'clarify_intent (if new feature) or check_action (if fixing something)',

      // Include key information for the AI
      criticalDecisions: result.context.decisions
        .filter(d => d.impact === 'critical' || d.impact === 'high')
        .map(d => `${d.decision}: ${d.reasoning}`),

      failedApproaches: result.context.recentAttempts
        .filter(a => a.result === 'failure' && a.shouldNotRetry)
        .map(a => `${a.approach}: ${a.errorMessage}`),

      activeBlockers: result.context.blockers.map(b => b.description),
    };
  },
};

/**
 * CLARIFY INTENT TOOL
 *
 * Analyzes user request and determines what questions to ask.
 * Uses confidence scoring to avoid assumptions.
 */
export const clarifyIntentTool = {
  name: 'clarify_intent',
  description: `Analyze user request and determine confidence levels.
Returns clarification questions for any field where confidence is below threshold.

Use this when:
- Starting a new feature/build
- User request is ambiguous
- You're not 80%+ confident about what they want

DO NOT proceed to discover_patterns until confidence is high enough.`,

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
    userRequest: z.string().describe('What the user asked for'),
  }),

  handler: async (input: { sessionId: string; userRequest: string }) => {
    // Check if context was loaded
    const state = safetyStateCache.get(input.sessionId);
    if (!state?.gates.contextLoaded) {
      return {
        success: false,
        error: 'GATE VIOLATION: Must call load_context before clarify_intent',
        action: 'Call load_context first',
      };
    }

    const result = await ScoperAgentService.analyzeIntent(input.userRequest);

    // Create scoping session
    ScopingCache.create(input.sessionId, input.userRequest, result.scores);

    // Update safety state
    state.gates.intentClarified = result.readyToProceed;

    if (!result.readyToProceed) {
      return {
        success: true,
        readyToProceed: false,
        overallConfidence: result.overallConfidence,
        clarificationNeeded: true,

        questions: result.clarificationQuestions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          required: q.required,
          priority: q.priority,
        })),

        message: `I need to clarify a few things before proceeding. Confidence: ${result.overallConfidence}%`,

        lowConfidenceFields: result.scores
          .filter(s => s.needsClarification)
          .map(s => ({ field: s.field, confidence: s.confidence, reasoning: s.reasoning })),
      };
    }

    return {
      success: true,
      readyToProceed: true,
      overallConfidence: result.overallConfidence,

      confirmedScope: ScoperAgentService.formatScopingPrompt(result.scores),
      confirmationSummary: ScoperAgentService.generateConfirmationSummary(result.scores),

      message: 'Intent is clear. Please confirm the summary before proceeding.',
      nextGate: 'User confirmation, then discover_patterns',
    };
  },
};

/**
 * ANSWER CLARIFICATION TOOL
 *
 * Process user's answer to a clarification question.
 */
export const answerClarificationTool = {
  name: 'answer_clarification',
  description: 'Process user\'s answer to a clarification question and update confidence scores.',

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
    questionId: z.string().describe('ID of the question being answered'),
    answer: z.string().describe('User\'s answer'),
  }),

  handler: async (input: { sessionId: string; questionId: string; answer: string }) => {
    const scopingSession = ScopingCache.get(input.sessionId);
    if (!scopingSession) {
      return {
        success: false,
        error: 'No active scoping session. Call clarify_intent first.',
      };
    }

    const result = await ScoperAgentService.processAnswer(
      scopingSession.scores,
      input.questionId,
      input.answer
    );

    // Update cache
    ScopingCache.updateScores(input.sessionId, result.scores);
    ScopingCache.addQuestion(input.sessionId, input.questionId);

    // Update safety state
    const state = safetyStateCache.get(input.sessionId);
    if (state) {
      state.gates.intentClarified = result.readyToProceed;
    }

    if (!result.readyToProceed) {
      return {
        success: true,
        readyToProceed: false,
        overallConfidence: result.overallConfidence,
        remainingQuestions: result.clarificationQuestions,
        message: `Got it. ${result.clarificationQuestions.length} more questions to clarify.`,
      };
    }

    return {
      success: true,
      readyToProceed: true,
      overallConfidence: result.overallConfidence,
      confirmationSummary: ScoperAgentService.generateConfirmationSummary(result.scores),
      message: 'All questions answered. Please confirm the summary.',
    };
  },
};

/**
 * CHECK ACTION TOOL
 *
 * Validates an action before execution.
 * Checks for contradictions and scope violations.
 */
export const checkActionTool = {
  name: 'check_action',
  description: `Validate an action before executing it.
Checks:
- Contradictions with existing decisions
- Scope violations (if scope lock is active)
- Whether this approach has already been tried and failed

Call this BEFORE making any significant change.`,

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
    action: z.string().describe('Description of what you\'re about to do'),
    targetFile: z.string().optional().describe('File being modified (if applicable)'),
    actionType: z.enum(['create-file', 'modify-file', 'delete-file', 'add-dependency', 'remove-dependency', 'run-command', 'modify-config']).optional(),
  }),

  handler: async (input: {
    sessionId: string;
    action: string;
    targetFile?: string;
    actionType?: string;
  }) => {
    const state = safetyStateCache.get(input.sessionId);

    // Check for contradictions
    const contradiction = ScopeLockService.checkContradiction(
      input.action,
      state?.decisions || []
    );

    if (contradiction) {
      return {
        success: false,
        blocked: true,
        reason: 'CONTRADICTION DETECTED',
        conflictingDecision: {
          decision: contradiction.conflictingDecision.decision,
          reasoning: contradiction.conflictingDecision.reasoning,
          impact: contradiction.conflictingDecision.impact,
        },
        explanation: contradiction.explanation,
        severity: contradiction.severity,
        options: [
          'Cancel this action',
          'Ask user to override the decision',
          'Modify approach to not conflict',
        ],
      };
    }

    // Check scope lock if active
    const scopeLock = ScopeLockCache.get(input.sessionId);
    if (scopeLock && input.targetFile && input.actionType) {
      const scopeCheck = ScopeLockService.checkAction(scopeLock, {
        type: input.actionType as any,
        targetFile: input.targetFile,
      });

      if (!scopeCheck.allowed) {
        // Record violation
        if (scopeCheck.violation) {
          ScopeLockCache.addViolation(input.sessionId, scopeCheck.violation);
        }

        return {
          success: false,
          blocked: true,
          reason: 'SCOPE VIOLATION',
          explanation: scopeCheck.reason,
          scopeLock: ScopeLockService.formatForDisplay(scopeLock),
          options: [
            'Stay within scope',
            'Ask user to expand scope',
          ],
        };
      }
    }

    // Check if approach was already tried
    const attempts = AttemptCache.get(input.sessionId);
    const attemptCheck = AttemptTrackerService.hasBeenTried(
      input.action,
      input.action,
      attempts
    );

    if (attemptCheck.alreadyTried && attemptCheck.previousAttempt?.result === 'failure') {
      const alternatives = AttemptTrackerService.suggestAlternatives(input.action, attempts);

      return {
        success: true,
        warning: 'SIMILAR APPROACH TRIED BEFORE',
        previousAttempt: {
          approach: attemptCheck.previousAttempt.approach,
          result: attemptCheck.previousAttempt.result,
          error: attemptCheck.previousAttempt.errorMessage,
        },
        recommendation: attemptCheck.recommendation,
        suggestedAlternatives: alternatives,
        proceed: false,
        message: 'Consider a different approach. See suggestedAlternatives.',
      };
    }

    // Update gate status
    if (state) {
      state.gates.contradictionsChecked = true;
    }

    return {
      success: true,
      blocked: false,
      proceed: true,
      message: 'Action is safe to proceed.',
      recommendation: attemptCheck.recommendation || undefined,
    };
  },
};

/**
 * LOG ATTEMPT TOOL
 *
 * Record what was tried and the result.
 * Prevents repeating failed approaches.
 */
export const logAttemptTool = {
  name: 'log_attempt',
  description: `Log an attempt to fix/implement something.
Call this AFTER trying an approach to record whether it worked or not.
This prevents repeating the same failed approaches in future sessions.`,

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
    issue: z.string().describe('What problem you were trying to solve'),
    approach: z.string().describe('What approach you tried'),
    codeOrCommand: z.string().describe('The actual code or command used'),
    result: z.enum(['success', 'failure', 'partial']).describe('Did it work?'),
    errorMessage: z.string().optional().describe('Error message if failed'),
    lessonsLearned: z.string().optional().describe('What you learned from this attempt'),
  }),

  handler: async (input: {
    sessionId: string;
    issue: string;
    approach: string;
    codeOrCommand: string;
    result: 'success' | 'failure' | 'partial';
    errorMessage?: string;
    lessonsLearned?: string;
  }) => {
    const attempt = AttemptTrackerService.createAttempt({
      issue: input.issue,
      approach: input.approach,
      codeOrCommand: input.codeOrCommand,
      result: input.result,
      errorMessage: input.errorMessage,
      lessonsLearned: input.lessonsLearned,
    });

    // Add to cache
    AttemptCache.add(input.sessionId, attempt);

    // Update safety state
    const state = safetyStateCache.get(input.sessionId);
    if (state) {
      state.attempts.push(attempt);
    }

    if (input.result === 'success') {
      return {
        success: true,
        message: 'Attempt logged as successful.',
        attemptId: attempt.id,
      };
    }

    // For failures, suggest alternatives
    const alternatives = AttemptTrackerService.suggestAlternatives(
      input.issue,
      AttemptCache.get(input.sessionId)
    );

    return {
      success: true,
      message: 'Attempt logged as failed.',
      attemptId: attempt.id,
      shouldNotRetry: attempt.shouldNotRetry,
      suggestedAlternatives: alternatives,
      recommendation: alternatives.length > 0
        ? `Try: ${alternatives[0]}`
        : 'Consider asking the user for help.',
    };
  },
};

/**
 * LOG DECISION TOOL
 *
 * Record a significant decision with reasoning.
 */
export const logDecisionTool = {
  name: 'log_decision',
  description: `Log a significant decision with reasoning.
Use this for:
- Architecture decisions
- Technology choices
- Pattern selections
- Security decisions
- Any choice that should be consistent across sessions

Decisions are checked before future actions to prevent contradictions.`,

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
    decision: z.string().describe('What was decided'),
    category: z.enum([
      'architecture', 'tech-stack', 'patterns', 'security',
      'data-model', 'api-design', 'ui-design', 'integration',
      'deployment', 'business-logic'
    ]).describe('Category of decision'),
    reasoning: z.string().describe('Why this decision was made'),
    alternativesConsidered: z.array(z.string()).optional().describe('Other options that were considered'),
    impact: z.enum(['low', 'medium', 'high', 'critical']).describe('How impactful is this decision'),
    reversible: z.boolean().optional().describe('Can this be changed later?'),
    relatedFiles: z.array(z.string()).optional().describe('Files affected by this decision'),
    userApproved: z.boolean().optional().describe('Did the user explicitly approve this?'),
  }),

  handler: async (input: {
    sessionId: string;
    decision: string;
    category: string;
    reasoning: string;
    alternativesConsidered?: string[];
    impact: 'low' | 'medium' | 'high' | 'critical';
    reversible?: boolean;
    relatedFiles?: string[];
    userApproved?: boolean;
  }) => {
    const decision = DecisionLogService.createDecision({
      decision: input.decision,
      category: input.category as any,
      reasoning: input.reasoning,
      alternativesConsidered: input.alternativesConsidered,
      madeBy: 'ai',
      userApproved: input.userApproved,
      reversible: input.reversible,
      impact: input.impact,
      relatedFiles: input.relatedFiles,
    });

    // Update safety state
    const state = safetyStateCache.get(input.sessionId);
    if (state) {
      state.decisions.push(decision);
    }

    return {
      success: true,
      decisionId: decision.id,
      message: `Decision logged: ${input.decision}`,
      markdown: DecisionLogService.formatDecisionForMarkdown(decision),
      reminder: input.impact === 'critical' || input.impact === 'high'
        ? 'This is a high-impact decision. Future actions will be checked against it.'
        : undefined,
    };
  },
};

/**
 * DEFINE SCOPE TOOL
 *
 * Lock the scope for a task to prevent scope creep.
 */
export const defineScopeTool = {
  name: 'define_scope',
  description: `Define and lock the scope for a task.
Use this after clarifying intent to set boundaries on what can be changed.
Prevents scope creep by blocking out-of-scope modifications.`,

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
    userRequest: z.string().describe('The original user request'),
    allowedDirectories: z.array(z.string()).optional().describe('Directories that can be modified'),
    forbiddenFiles: z.array(z.string()).optional().describe('Files that should not be touched'),
  }),

  handler: async (input: {
    sessionId: string;
    userRequest: string;
    allowedDirectories?: string[];
    forbiddenFiles?: string[];
  }) => {
    const scopeLock = ScopeLockService.createScopeLock({
      userRequest: input.userRequest,
      inferredScope: {
        allowedDirectories: input.allowedDirectories,
        forbiddenFiles: input.forbiddenFiles,
      },
    });

    // Cache the scope lock
    ScopeLockCache.set(input.sessionId, scopeLock);

    // Update safety state
    const state = safetyStateCache.get(input.sessionId);
    if (state) {
      state.scopeLock = scopeLock;
      state.gates.scopeLocked = true;
    }

    return {
      success: true,
      scopeLockId: scopeLock.id,
      summary: ScopeLockService.formatForDisplay(scopeLock),
      message: 'Scope locked. Out-of-scope modifications will be blocked.',
    };
  },
};

/**
 * GET SAFETY STATUS TOOL
 *
 * Check which gates have been passed.
 */
export const getSafetyStatusTool = {
  name: 'get_safety_status',
  description: 'Check which safety gates have been passed and what\'s needed next.',

  inputSchema: z.object({
    sessionId: z.string().describe('Session ID'),
  }),

  handler: async (input: { sessionId: string }) => {
    const state = safetyStateCache.get(input.sessionId);

    if (!state) {
      return {
        success: true,
        status: 'No safety state initialized',
        nextAction: 'Call load_context to begin',
        gates: {
          contextLoaded: false,
          intentClarified: false,
          contradictionsChecked: false,
          scopeLocked: false,
          patternsLoaded: false,
          implementationStarted: false,
          verificationPassed: false,
          documentationUpdated: false,
        },
      };
    }

    // Determine next action
    let nextAction = '';
    if (!state.gates.contextLoaded) {
      nextAction = 'Call load_context';
    } else if (!state.gates.intentClarified) {
      nextAction = 'Call clarify_intent';
    } else if (!state.gates.contradictionsChecked) {
      nextAction = 'Call check_action before making changes';
    } else if (!state.gates.patternsLoaded) {
      nextAction = 'Call discover_patterns';
    } else if (!state.gates.verificationPassed) {
      nextAction = 'Call validate_complete when done';
    }

    return {
      success: true,
      gates: state.gates,
      nextAction,
      violations: state.scopeLock?.violations || [],
      contradictionsFound: state.contradictions.length,
      attemptsLogged: state.attempts.length,
      decisionsLogged: state.decisions.length,
    };
  },
};

// =============================================================================
// EXPORT ALL TOOLS
// =============================================================================

export const safetyTools = [
  loadContextTool,
  clarifyIntentTool,
  answerClarificationTool,
  checkActionTool,
  logAttemptTool,
  logDecisionTool,
  defineScopeTool,
  getSafetyStatusTool,
];
