/**
 * CODEBAKERS SAFETY SYSTEM TYPES
 *
 * These types define the multi-gate safety system that compensates
 * for AI assistant limitations (context loss, ignoring instructions,
 * making assumptions, not verifying work).
 */

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Complete project context loaded before any action
 */
export interface ProjectContext {
  // Current state
  version: string;
  projectName: string;
  projectType: 'new' | 'existing';
  currentPhase: string;
  lastUpdated: string;

  // Tech stack
  stack: {
    framework: string;
    database: string;
    orm: string;
    auth: string;
    ui: string;
    payments?: string;
  };

  // What's been built
  builtFeatures: string[];
  pendingFeatures: string[];

  // Recent activity
  recentCommits: string[];
  recentChanges: FileChange[];

  // Decision context
  decisions: Decision[];

  // Attempt history
  recentAttempts: Attempt[];

  // Active blockers
  blockers: Blocker[];
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  timestamp: string;
  summary: string;
}

// =============================================================================
// DECISION TYPES
// =============================================================================

/**
 * A logged decision with reasoning
 */
export interface Decision {
  id: string;
  timestamp: string;

  // What was decided
  decision: string;
  category: DecisionCategory;

  // Context
  reasoning: string;
  alternativesConsidered: string[];

  // Metadata
  madeBy: 'user' | 'ai' | 'system';
  userApproved: boolean;
  reversible: boolean;
  impact: 'low' | 'medium' | 'high' | 'critical';

  // Related artifacts
  relatedFiles: string[];
  relatedDecisions: string[];
}

export type DecisionCategory =
  | 'architecture'      // Core system design
  | 'tech-stack'        // Technology choices
  | 'patterns'          // Code patterns to follow
  | 'security'          // Security-related
  | 'data-model'        // Database schema
  | 'api-design'        // API structure
  | 'ui-design'         // UI/UX decisions
  | 'integration'       // Third-party integrations
  | 'deployment'        // Deployment/infra
  | 'business-logic';   // Feature behavior

// =============================================================================
// ATTEMPT TYPES
// =============================================================================

/**
 * A logged attempt to fix/implement something
 */
export interface Attempt {
  id: string;
  timestamp: string;

  // What was being attempted
  issue: string;
  issueHash: string; // For deduplication

  // The approach tried
  approach: string;
  codeOrCommand: string;

  // Result
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;

  // Learning
  lessonsLearned?: string;
  shouldNotRetry: boolean;
}

// =============================================================================
// CONTRADICTION TYPES
// =============================================================================

/**
 * A detected contradiction between proposed action and existing decision
 */
export interface Contradiction {
  proposedAction: string;
  conflictingDecision: Decision;
  severity: 'warning' | 'error' | 'critical';
  explanation: string;
  resolution: ContradictionResolution;
}

export type ContradictionResolution =
  | { type: 'cancel'; reason: string }
  | { type: 'override'; userApproved: boolean; newDecision: string }
  | { type: 'modify'; adjustedAction: string };

// =============================================================================
// SCOPE LOCK TYPES
// =============================================================================

/**
 * Defines what the AI is allowed to do for a specific task
 */
export interface ScopeLock {
  id: string;
  createdAt: string;

  // What was requested
  userRequest: string;

  // Allowed actions
  allowedFiles: string[];       // Files that can be created/modified
  allowedDirectories: string[]; // Directories that can be touched
  allowedActions: ScopeAction[];

  // Forbidden actions
  forbiddenFiles: string[];     // Files that must NOT be touched
  forbiddenPatterns: string[];  // Regex patterns to block

  // Scope boundaries
  maxNewFiles: number;
  maxModifiedFiles: number;
  canDeleteFiles: boolean;
  canModifyPackageJson: boolean;
  canModifySchema: boolean;

  // Status
  isActive: boolean;
  violations: ScopeViolation[];
}

export type ScopeAction =
  | 'create-file'
  | 'modify-file'
  | 'delete-file'
  | 'add-dependency'
  | 'remove-dependency'
  | 'run-command'
  | 'modify-config';

export interface ScopeViolation {
  timestamp: string;
  attemptedAction: ScopeAction;
  targetFile: string;
  reason: string;
  blocked: boolean;
}

// =============================================================================
// VERIFICATION TYPES
// =============================================================================

/**
 * Result of verifying a step
 */
export interface StepVerification {
  stepId: string;
  stepDescription: string;
  timestamp: string;

  checks: VerificationCheck[];
  overallResult: 'pass' | 'fail' | 'warning';

  // If failed
  errors: string[];
  suggestedFixes: string[];
}

export interface VerificationCheck {
  name: string;
  description: string;
  result: 'pass' | 'fail' | 'skip';
  details?: string;
}

// =============================================================================
// CHECKPOINT TYPES
// =============================================================================

/**
 * A checkpoint requiring user approval
 */
export interface Checkpoint {
  id: string;
  timestamp: string;

  // What needs approval
  action: string;
  category: CheckpointCategory;

  // Context for user
  description: string;
  impact: string;
  reversibility: string;

  // Alternatives
  alternatives: string[];

  // Status
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  userResponse?: string;
  modifiedAction?: string;
}

export type CheckpointCategory =
  | 'architecture-change'
  | 'file-deletion'
  | 'schema-change'
  | 'security-change'
  | 'dependency-change'
  | 'breaking-change';

// =============================================================================
// BLOCKER TYPES
// =============================================================================

/**
 * Something blocking progress
 */
export interface Blocker {
  id: string;
  createdAt: string;

  // What's blocked
  description: string;
  category: 'error' | 'missing-info' | 'waiting-external' | 'needs-decision';

  // Context
  errorMessage?: string;
  attemptsMade: string[];

  // Resolution
  status: 'active' | 'resolved' | 'bypassed';
  resolvedAt?: string;
  resolution?: string;
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

/**
 * Confidence score for a piece of understanding
 */
export interface ConfidenceScore {
  field: string;
  value: unknown;
  confidence: number; // 0-100
  reasoning: string;
  needsClarification: boolean;
}

/**
 * Scoping result with confidence
 */
export interface ScopingResult {
  scores: ConfidenceScore[];
  overallConfidence: number;
  clarificationQuestions: ClarificationQuestion[];
  readyToProceed: boolean;
}

export interface ClarificationQuestion {
  id: string;
  field: string;
  question: string;
  options?: string[];
  required: boolean;
  priority: 'high' | 'medium' | 'low';
}

// =============================================================================
// GATE STATUS
// =============================================================================

/**
 * Status of each gate in the safety system
 */
export interface GateStatus {
  contextLoaded: boolean;
  intentClarified: boolean;
  contradictionsChecked: boolean;
  scopeLocked: boolean;
  patternsLoaded: boolean;
  implementationStarted: boolean;
  verificationPassed: boolean;
  documentationUpdated: boolean;
}

/**
 * The complete safety state for a session
 */
export interface SafetyState {
  sessionId: string;
  projectHash: string;

  gates: GateStatus;
  context: ProjectContext | null;
  scopeLock: ScopeLock | null;

  decisions: Decision[];
  attempts: Attempt[];
  contradictions: Contradiction[];
  checkpoints: Checkpoint[];
  verifications: StepVerification[];

  currentStep: number;
  totalSteps: number;
}

// =============================================================================
// DEVLOG TYPES
// =============================================================================

export interface DevlogEntry {
  date: string;
  title: string;
  sessionId: string;
  taskSize: 'trivial' | 'small' | 'medium' | 'large';
  status: 'completed' | 'in_progress' | 'blocked';

  whatWasDone: string[];
  filesChanged: FileChangeEntry[];
  decisionsMode: string[];
  nextSteps: string[];
}

export interface FileChangeEntry {
  path: string;
  change: string;
}
