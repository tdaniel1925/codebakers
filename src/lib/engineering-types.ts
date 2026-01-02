/**
 * CODEBAKERS ENGINEERING SYSTEM TYPES
 *
 * Core data structures for the AI agent-based engineering workflow.
 * This system enables enterprise-grade software development using AI agents
 * that collaborate like a professional software team.
 */

// =============================================================================
// PROJECT SCOPING & CONTEXT
// =============================================================================

/**
 * Project scope - captured during initial scoping wizard
 */
export interface ProjectScope {
  // Basic info
  name: string;
  description: string;
  targetAudience: 'consumers' | 'businesses' | 'internal' | 'developers';

  // Business scope
  isFullBusiness: boolean; // Needs marketing, deployment, teams, etc.
  needsMarketing: boolean;
  needsAnalytics: boolean;
  needsTeamFeatures: boolean;
  needsAdminDashboard: boolean;

  // Technical scope
  platforms: ('web' | 'mobile' | 'api')[];
  hasRealtime: boolean;
  hasPayments: boolean;
  hasAuth: boolean;
  hasFileUploads: boolean;

  // Compliance requirements
  compliance: {
    hipaa: boolean;
    pci: boolean;
    gdpr: boolean;
    soc2: boolean;
    coppa: boolean;
  };

  // Scale expectations
  expectedUsers: 'small' | 'medium' | 'large' | 'enterprise';
  launchTimeline: 'asap' | 'weeks' | 'months' | 'flexible';
}

/**
 * Full project context - the single source of truth for a build
 */
export interface ProjectContext {
  // Identity
  id: string;
  teamId: string;
  projectHash: string;

  // Scope from wizard
  scope: ProjectScope;

  // Stack decisions (locked after first detection)
  stack: {
    framework: string; // nextjs, remix, etc.
    database: string; // supabase, planetscale, etc.
    orm: string; // drizzle, prisma, etc.
    auth: string; // supabase, clerk, etc.
    ui: string; // shadcn, chakra, etc.
    payments?: string; // stripe, paypal, etc.
  };

  // Current state
  currentPhase: EngineeringPhase;
  currentAgent: AgentRole;
  gateStatus: Record<EngineeringPhase, GateStatus>;

  // Accumulated artifacts
  artifacts: {
    prd?: string; // Product Requirements Document
    techSpec?: string; // Technical Specification
    apiDocs?: string; // API Documentation
    securityAudit?: string; // Security Audit Report
    userGuide?: string; // User Guide
    deploymentGuide?: string; // Deployment Guide
  };

  // Dependency graph
  dependencyGraph: DependencyGraph;

  // Agent memory - decisions made and why
  decisions: AgentDecision[];

  // Timestamps
  startedAt: Date;
  lastActivityAt: Date;
}

// =============================================================================
// ENGINEERING PHASES
// =============================================================================

export type EngineeringPhase =
  | 'scoping' // Initial wizard, define scope
  | 'requirements' // PM agent creates PRD
  | 'architecture' // Architect agent designs system
  | 'design_review' // Review architecture with user
  | 'implementation' // Engineer agents build features
  | 'code_review' // Review code quality
  | 'testing' // QA agent writes and runs tests
  | 'security_review' // Security agent audits code
  | 'documentation' // Docs agent generates docs
  | 'staging' // Pre-production verification
  | 'launch'; // Final deployment

export interface GateStatus {
  phase: EngineeringPhase;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
  passedAt?: Date;
  failedReason?: string;
  approvedBy?: string; // 'user' or 'auto'
  artifacts?: string[]; // Documents produced at this gate
}

export interface PhaseConfig {
  phase: EngineeringPhase;
  displayName: string;
  description: string;
  agent: AgentRole;
  requiresApproval: boolean; // Must user approve before next phase?
  canSkip: boolean; // Can this phase be skipped?
  producesArtifacts: string[]; // What docs does this phase produce?
  inputsRequired: string[]; // What must exist before this phase?
}

/**
 * Default phase configuration
 */
export const ENGINEERING_PHASES: PhaseConfig[] = [
  {
    phase: 'scoping',
    displayName: 'Project Scoping',
    description: 'Define what you\'re building and how big it is',
    agent: 'orchestrator',
    requiresApproval: false,
    canSkip: false,
    producesArtifacts: ['scope.json'],
    inputsRequired: [],
  },
  {
    phase: 'requirements',
    displayName: 'Requirements',
    description: 'PM agent creates detailed product requirements',
    agent: 'pm',
    requiresApproval: true,
    canSkip: false,
    producesArtifacts: ['prd.md'],
    inputsRequired: ['scope.json'],
  },
  {
    phase: 'architecture',
    displayName: 'Architecture',
    description: 'Architect agent designs system structure',
    agent: 'architect',
    requiresApproval: true,
    canSkip: false,
    producesArtifacts: ['tech-spec.md', 'dependency-graph.json'],
    inputsRequired: ['prd.md'],
  },
  {
    phase: 'design_review',
    displayName: 'Design Review',
    description: 'Review architecture with stakeholders',
    agent: 'orchestrator',
    requiresApproval: true,
    canSkip: true,
    producesArtifacts: ['review-notes.md'],
    inputsRequired: ['tech-spec.md'],
  },
  {
    phase: 'implementation',
    displayName: 'Implementation',
    description: 'Engineer agents build the features',
    agent: 'engineer',
    requiresApproval: false, // Approval per feature instead
    canSkip: false,
    producesArtifacts: ['source-code'],
    inputsRequired: ['tech-spec.md'],
  },
  {
    phase: 'code_review',
    displayName: 'Code Review',
    description: 'Review code quality and patterns',
    agent: 'engineer',
    requiresApproval: false,
    canSkip: true,
    producesArtifacts: ['code-review.md'],
    inputsRequired: ['source-code'],
  },
  {
    phase: 'testing',
    displayName: 'Testing',
    description: 'QA agent writes and runs comprehensive tests',
    agent: 'qa',
    requiresApproval: false,
    canSkip: false,
    producesArtifacts: ['test-report.md', 'test-files'],
    inputsRequired: ['source-code'],
  },
  {
    phase: 'security_review',
    displayName: 'Security Review',
    description: 'Security agent audits for vulnerabilities',
    agent: 'security',
    requiresApproval: true,
    canSkip: false,
    producesArtifacts: ['security-audit.md'],
    inputsRequired: ['source-code'],
  },
  {
    phase: 'documentation',
    displayName: 'Documentation',
    description: 'Generate comprehensive documentation',
    agent: 'documentation',
    requiresApproval: false,
    canSkip: true,
    producesArtifacts: ['api-docs.md', 'user-guide.md', 'readme.md'],
    inputsRequired: ['source-code'],
  },
  {
    phase: 'staging',
    displayName: 'Staging',
    description: 'Deploy to staging and verify',
    agent: 'devops',
    requiresApproval: true,
    canSkip: true,
    producesArtifacts: ['deployment-report.md'],
    inputsRequired: ['source-code', 'test-report.md'],
  },
  {
    phase: 'launch',
    displayName: 'Launch',
    description: 'Deploy to production',
    agent: 'devops',
    requiresApproval: true,
    canSkip: false,
    producesArtifacts: ['launch-report.md'],
    inputsRequired: ['deployment-report.md'],
  },
];

// =============================================================================
// AGENT SYSTEM
// =============================================================================

export type AgentRole =
  | 'orchestrator' // Coordinates all other agents
  | 'pm' // Product Manager - user-focused, creates PRDs
  | 'architect' // System Architect - designs structure
  | 'engineer' // Software Engineer - writes code
  | 'qa' // QA Engineer - writes tests, finds bugs
  | 'security' // Security Engineer - audits vulnerabilities
  | 'documentation' // Technical Writer - creates docs
  | 'devops'; // DevOps Engineer - deployment, infrastructure

export interface AgentConfig {
  role: AgentRole;
  displayName: string;
  description: string;
  personality: string; // How this agent "thinks"
  focusAreas: string[];
  systemPromptAdditions: string; // Added to base system prompt
}

/**
 * Agent configurations - defines how each agent behaves
 */
export const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  orchestrator: {
    role: 'orchestrator',
    displayName: 'Orchestrator',
    description: 'Coordinates the entire build process',
    personality: 'Organized, methodical, keeps everyone on track',
    focusAreas: ['coordination', 'progress tracking', 'gate management'],
    systemPromptAdditions: `You are the Orchestrator - the lead coordinator of this engineering project.
Your job is to:
1. Manage the flow between engineering phases
2. Ensure gates are passed before proceeding
3. Escalate blockers to the user
4. Keep all agents aligned with the project scope

Never make implementation decisions yourself - delegate to the appropriate specialist agent.`,
  },
  pm: {
    role: 'pm',
    displayName: 'Product Manager',
    description: 'Focuses on user needs and product requirements',
    personality: 'User-focused, asks "why", thinks about edge cases',
    focusAreas: ['user stories', 'acceptance criteria', 'prioritization'],
    systemPromptAdditions: `You are the Product Manager agent.
Your perspective is always USER-FIRST. For every feature, ask:
- Who is the user for this?
- What problem does this solve?
- How will they discover this feature?
- What happens when things go wrong?

You create PRDs that engineers can implement without ambiguity.
Challenge vague requirements - specificity prevents bugs.`,
  },
  architect: {
    role: 'architect',
    displayName: 'System Architect',
    description: 'Designs system structure and technical decisions',
    personality: 'Strategic, considers scale, thinks in systems',
    focusAreas: ['system design', 'data flow', 'scalability', 'patterns'],
    systemPromptAdditions: `You are the System Architect agent.
You think in SYSTEMS, not features. For every decision:
- How does this affect the dependency graph?
- What breaks if this component fails?
- How will this scale to 10x users?
- Is this the simplest solution that could work?

You create tech specs that prevent technical debt.
Document EVERY architectural decision and WHY.`,
  },
  engineer: {
    role: 'engineer',
    displayName: 'Software Engineer',
    description: 'Writes production-quality code',
    personality: 'Practical, follows patterns, writes tests',
    focusAreas: ['implementation', 'code quality', 'patterns', 'refactoring'],
    systemPromptAdditions: `You are the Software Engineer agent.
You write CODE THAT WORKS. For every implementation:
- Follow the established patterns in this codebase
- Handle errors explicitly - never swallow them
- Add loading states for async operations
- Write the test BEFORE saying "done"

You never ship code you wouldn't be proud of.`,
  },
  qa: {
    role: 'qa',
    displayName: 'QA Engineer',
    description: 'Tests everything, finds edge cases',
    personality: 'Adversarial, tries to break things, thorough',
    focusAreas: ['testing', 'edge cases', 'regression', 'coverage'],
    systemPromptAdditions: `You are the QA Engineer agent.
Your job is to BREAK THINGS before users do. For every feature:
- Happy path: Does the normal flow work?
- Error path: What if the API fails?
- Edge cases: Empty inputs, max lengths, special characters
- Boundary: What about 0, 1, -1, MAX_INT?
- Concurrent: What if two users do this simultaneously?

You write tests that would catch bugs before production.
"It works on my machine" is not acceptable.`,
  },
  security: {
    role: 'security',
    displayName: 'Security Engineer',
    description: 'Audits for vulnerabilities and compliance',
    personality: 'Paranoid, assumes attackers, thinks like hackers',
    focusAreas: ['vulnerabilities', 'auth', 'data protection', 'compliance'],
    systemPromptAdditions: `You are the Security Engineer agent.
You are PARANOID by design. For every code path:
- Can this be exploited by a malicious user?
- Is sensitive data properly encrypted/hashed?
- Are there injection vulnerabilities?
- Does this follow principle of least privilege?
- Are secrets exposed anywhere?

You audit code as if attackers are watching.
Flag ANYTHING suspicious - false positives are fine, breaches aren't.`,
  },
  documentation: {
    role: 'documentation',
    displayName: 'Technical Writer',
    description: 'Creates comprehensive documentation',
    personality: 'Clear communicator, thinks about readers',
    focusAreas: ['api docs', 'user guides', 'code comments', 'readme'],
    systemPromptAdditions: `You are the Documentation agent.
You make complex things SIMPLE to understand. For every doc:
- Who is reading this? (developer, user, admin?)
- What do they need to accomplish?
- What's the simplest path to success?
- What errors might they hit and how to fix?

You write docs that prevent support tickets.
If something is hard to document, it might be hard to use.`,
  },
  devops: {
    role: 'devops',
    displayName: 'DevOps Engineer',
    description: 'Handles deployment and infrastructure',
    personality: 'Reliable, thinks about failures, automates everything',
    focusAreas: ['deployment', 'ci/cd', 'monitoring', 'infrastructure'],
    systemPromptAdditions: `You are the DevOps Engineer agent.
You make deployments BORING (in a good way). For every deployment:
- Can this be rolled back in 60 seconds?
- What alerts will fire if this breaks?
- Are environment variables documented?
- Is the deploy process automated?

You build infrastructure that lets engineers sleep at night.`,
  },
};

// =============================================================================
// AGENT COMMUNICATION
// =============================================================================

export interface AgentMessage {
  id: string;
  timestamp: Date;
  fromAgent: AgentRole | 'user';
  toAgent: AgentRole | 'user' | 'all';
  messageType: AgentMessageType;
  content: string;
  metadata?: Record<string, unknown>;
}

export type AgentMessageType =
  | 'request' // Asking another agent to do something
  | 'response' // Responding to a request
  | 'review' // Reviewing another agent's work
  | 'approval' // Approving to proceed
  | 'rejection' // Rejecting with reasons
  | 'question' // Asking for clarification
  | 'update' // Status update
  | 'handoff'; // Passing work to next agent

export interface AgentDecision {
  id: string;
  timestamp: Date;
  agent: AgentRole;
  phase: EngineeringPhase;
  decision: string; // What was decided
  reasoning: string; // Why this decision
  alternatives: string[]; // What else was considered
  confidence: number; // 0-100
  reversible: boolean; // Can this be undone?
  impact: ('low' | 'medium' | 'high' | 'critical');
}

// =============================================================================
// DEPENDENCY GRAPH
// =============================================================================

export interface DependencyNode {
  id: string;
  type: 'schema' | 'api' | 'component' | 'service' | 'page' | 'util' | 'config';
  name: string;
  filePath: string;
  createdAt: Date;
  modifiedAt: Date;
  createdByFeature?: string;
}

export interface DependencyEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'import' | 'api-call' | 'db-query' | 'event' | 'config';
  createdAt: Date;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

/**
 * Impact analysis result - what gets affected by a change
 */
export interface ImpactAnalysis {
  changedNode: DependencyNode;
  directlyAffected: DependencyNode[]; // First-level dependents
  transitivelyAffected: DependencyNode[]; // All downstream
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// =============================================================================
// DOCUMENT GENERATION
// =============================================================================

export interface DocumentSpec {
  type: 'prd' | 'tech-spec' | 'api-docs' | 'user-guide' | 'security-audit' | 'deployment-guide';
  title: string;
  format: 'markdown' | 'pdf' | 'html';
  sections: DocumentSection[];
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  order: number;
  level: 1 | 2 | 3; // Heading level
}

export interface GeneratedDocument {
  spec: DocumentSpec;
  content: string;
  generatedAt: Date;
  generatedByAgent: AgentRole;
  version: number;
}

// =============================================================================
// USER INTERFACE
// =============================================================================

/**
 * Progress display for the back office dashboard
 */
export interface EngineeringProgress {
  projectId: string;
  projectName: string;
  currentPhase: EngineeringPhase;
  overallProgress: number; // 0-100
  phases: PhaseProgress[];
  activeAgents: AgentRole[];
  recentActivity: AgentMessage[];
  blockers: string[];
  nextAction: string;
}

export interface PhaseProgress {
  phase: EngineeringPhase;
  displayName: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  artifacts: string[];
}

/**
 * Scoping wizard step
 */
export interface ScopingStep {
  id: string;
  question: string;
  description: string;
  type: 'single' | 'multiple' | 'boolean' | 'text';
  options?: ScopingOption[];
  required: boolean;
  dependsOn?: { stepId: string; value: unknown }; // Only show if previous answer matches
}

export interface ScopingOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

/**
 * Default scoping wizard steps
 */
export const SCOPING_WIZARD_STEPS: ScopingStep[] = [
  {
    id: 'name',
    question: 'What are you building?',
    description: 'Give your project a name',
    type: 'text',
    required: true,
  },
  {
    id: 'description',
    question: 'Describe it in one sentence',
    description: 'What does this app do?',
    type: 'text',
    required: true,
  },
  {
    id: 'audience',
    question: 'Who is this for?',
    description: 'Your target users',
    type: 'single',
    required: true,
    options: [
      { value: 'consumers', label: 'Consumers', description: 'Regular people (B2C)' },
      { value: 'businesses', label: 'Businesses', description: 'Companies (B2B)' },
      { value: 'internal', label: 'Internal Team', description: 'Your organization' },
      { value: 'developers', label: 'Developers', description: 'Technical users, APIs' },
    ],
  },
  {
    id: 'isFullBusiness',
    question: 'Is this a full business product?',
    description: 'Needs marketing, analytics, team features, etc.',
    type: 'boolean',
    required: true,
  },
  {
    id: 'platforms',
    question: 'Which platforms?',
    description: 'Where will users access this?',
    type: 'multiple',
    required: true,
    options: [
      { value: 'web', label: 'Web App', description: 'Browser-based' },
      { value: 'mobile', label: 'Mobile App', description: 'iOS/Android' },
      { value: 'api', label: 'API Only', description: 'Backend service' },
    ],
  },
  {
    id: 'hasAuth',
    question: 'Do users need accounts?',
    description: 'Login, signup, profiles',
    type: 'boolean',
    required: true,
  },
  {
    id: 'hasPayments',
    question: 'Will you charge money?',
    description: 'Subscriptions, one-time payments',
    type: 'boolean',
    required: true,
  },
  {
    id: 'hasRealtime',
    question: 'Need real-time features?',
    description: 'Live updates, chat, notifications',
    type: 'boolean',
    required: true,
  },
  {
    id: 'compliance',
    question: 'Any compliance requirements?',
    description: 'Skip if none apply',
    type: 'multiple',
    required: false,
    options: [
      { value: 'hipaa', label: 'HIPAA', description: 'Healthcare data' },
      { value: 'pci', label: 'PCI DSS', description: 'Payment card data' },
      { value: 'gdpr', label: 'GDPR', description: 'EU privacy' },
      { value: 'soc2', label: 'SOC 2', description: 'Enterprise security' },
      { value: 'coppa', label: 'COPPA', description: 'Children under 13' },
    ],
  },
  {
    id: 'expectedUsers',
    question: 'Expected scale?',
    description: 'Helps with architecture decisions',
    type: 'single',
    required: true,
    options: [
      { value: 'small', label: 'Small', description: '< 1,000 users' },
      { value: 'medium', label: 'Medium', description: '1,000 - 100,000 users' },
      { value: 'large', label: 'Large', description: '100,000 - 1M users' },
      { value: 'enterprise', label: 'Enterprise', description: '1M+ users' },
    ],
  },
  {
    id: 'launchTimeline',
    question: 'When do you want to launch?',
    description: 'Affects prioritization',
    type: 'single',
    required: true,
    options: [
      { value: 'asap', label: 'ASAP', description: 'Minimum viable product' },
      { value: 'weeks', label: 'Few weeks', description: 'Core features only' },
      { value: 'months', label: 'Few months', description: 'Full feature set' },
      { value: 'flexible', label: 'Flexible', description: 'Quality over speed' },
    ],
  },
];
