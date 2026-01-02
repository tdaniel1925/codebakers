/**
 * ENGINEERING ORCHESTRATOR SERVICE
 *
 * The central coordinator for the AI agent-based engineering workflow.
 * Manages phase transitions, agent handoffs, and gate enforcement.
 *
 * NO FRICTION: Everything is designed to be as easy as 1,2,3 for users.
 */

import { randomUUID } from 'crypto';
import {
  ProjectContext,
  ProjectScope,
  EngineeringPhase,
  GateStatus,
  AgentRole,
  AgentMessage,
  AgentDecision,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  ImpactAnalysis,
  ENGINEERING_PHASES,
  AGENT_CONFIGS,
  SCOPING_WIZARD_STEPS,
  ScopingStep,
  EngineeringProgress,
  PhaseProgress,
} from '@/lib/engineering-types';
import { ProjectTrackingService } from './project-tracking-service';

// =============================================================================
// ORCHESTRATOR STATE
// =============================================================================

interface OrchestratorState {
  context: ProjectContext;
  messages: AgentMessage[];
  isRunning: boolean;
  currentAgent: AgentRole;
  pendingApprovals: string[]; // Phase names waiting for user approval
}

// In-memory state for active sessions (would be Redis in production)
const activeSessions = new Map<string, OrchestratorState>();

// =============================================================================
// MAIN ORCHESTRATOR SERVICE
// =============================================================================

export class EngineeringOrchestratorService {
  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  /**
   * Start a new engineering session
   * This is the main entry point - called when user starts a build
   */
  static async startSession(
    teamId: string,
    projectHash: string,
    projectName: string
  ): Promise<{ sessionId: string; firstStep: ScopingStep }> {
    const sessionId = randomUUID();

    // Create initial context
    const context: ProjectContext = {
      id: sessionId,
      teamId,
      projectHash,
      scope: {
        name: projectName,
        description: '',
        targetAudience: 'consumers',
        isFullBusiness: false,
        needsMarketing: false,
        needsAnalytics: false,
        needsTeamFeatures: false,
        needsAdminDashboard: false,
        platforms: ['web'],
        hasRealtime: false,
        hasPayments: false,
        hasAuth: true,
        hasFileUploads: false,
        compliance: {
          hipaa: false,
          pci: false,
          gdpr: false,
          soc2: false,
          coppa: false,
        },
        expectedUsers: 'small',
        launchTimeline: 'flexible',
      },
      stack: {
        framework: 'nextjs',
        database: 'supabase',
        orm: 'drizzle',
        auth: 'supabase',
        ui: 'shadcn',
      },
      currentPhase: 'scoping',
      currentAgent: 'orchestrator',
      gateStatus: this.initializeGateStatus(),
      artifacts: {},
      dependencyGraph: { nodes: [], edges: [] },
      decisions: [],
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };

    // Store session
    activeSessions.set(sessionId, {
      context,
      messages: [],
      isRunning: true,
      currentAgent: 'orchestrator',
      pendingApprovals: [],
    });

    // Create project in database
    await ProjectTrackingService.getOrCreateProject(
      teamId,
      projectHash,
      projectName,
      'Engineering build started'
    );

    // Return first scoping step
    return {
      sessionId,
      firstStep: SCOPING_WIZARD_STEPS[0],
    };
  }

  /**
   * Resume an existing session
   */
  static getSession(sessionId: string): OrchestratorState | null {
    return activeSessions.get(sessionId) || null;
  }

  /**
   * Get current progress for display
   */
  static getProgress(sessionId: string): EngineeringProgress | null {
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    const { context, messages, pendingApprovals } = session;

    // Calculate phase progress
    const phases: PhaseProgress[] = ENGINEERING_PHASES.map((phase) => {
      const gate = context.gateStatus[phase.phase];
      return {
        phase: phase.phase,
        displayName: phase.displayName,
        status: gate?.status || 'pending',
        progress: gate?.status === 'passed' ? 100 : gate?.status === 'in_progress' ? 50 : 0,
        startedAt: undefined, // Would come from events
        completedAt: gate?.passedAt,
        artifacts: gate?.artifacts || [],
      };
    });

    // Calculate overall progress
    const completedPhases = phases.filter((p) => p.status === 'passed').length;
    const overallProgress = Math.round((completedPhases / phases.length) * 100);

    // Get blockers
    const blockers: string[] = [];
    if (pendingApprovals.length > 0) {
      blockers.push(`Waiting for approval: ${pendingApprovals.join(', ')}`);
    }

    // Determine next action
    const currentPhaseConfig = ENGINEERING_PHASES.find((p) => p.phase === context.currentPhase);
    const nextAction = currentPhaseConfig
      ? `${currentPhaseConfig.displayName}: ${currentPhaseConfig.description}`
      : 'Continue building';

    return {
      projectId: context.id,
      projectName: context.scope.name,
      currentPhase: context.currentPhase,
      overallProgress,
      phases,
      activeAgents: [context.currentAgent],
      recentActivity: messages.slice(-10),
      blockers,
      nextAction,
    };
  }

  // ========================================
  // SCOPING WIZARD
  // ========================================

  /**
   * Process a scoping wizard answer
   * Returns next step or null if scoping is complete
   */
  static async processScopingAnswer(
    sessionId: string,
    stepId: string,
    answer: unknown
  ): Promise<{ nextStep: ScopingStep | null; scopeComplete: boolean }> {
    const session = activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const { context } = session;

    // Update scope based on answer
    this.updateScopeFromAnswer(context.scope, stepId, answer);
    context.lastActivityAt = new Date();

    // Find current step index
    const currentIndex = SCOPING_WIZARD_STEPS.findIndex((s) => s.id === stepId);

    // Find next applicable step (considering dependencies)
    let nextStep: ScopingStep | null = null;
    for (let i = currentIndex + 1; i < SCOPING_WIZARD_STEPS.length; i++) {
      const step = SCOPING_WIZARD_STEPS[i];

      // Check dependencies
      if (step.dependsOn) {
        const depAnswer = this.getScopeValue(context.scope, step.dependsOn.stepId);
        if (depAnswer !== step.dependsOn.value) {
          continue; // Skip this step
        }
      }

      nextStep = step;
      break;
    }

    // If no next step, scoping is complete
    if (!nextStep) {
      // Infer additional scope values
      this.inferScopeDefaults(context.scope);

      // Mark scoping gate as passed
      context.gateStatus.scoping = {
        phase: 'scoping',
        status: 'passed',
        passedAt: new Date(),
        approvedBy: 'auto',
        artifacts: ['scope.json'],
      };

      // Move to requirements phase
      context.currentPhase = 'requirements';
      context.currentAgent = 'pm';

      // Record decision
      context.decisions.push({
        id: randomUUID(),
        timestamp: new Date(),
        agent: 'orchestrator',
        phase: 'scoping',
        decision: 'Project scope defined',
        reasoning: `Scope completed with: ${context.scope.platforms.join(', ')} platforms, ${context.scope.targetAudience} audience`,
        alternatives: [],
        confidence: 100,
        reversible: true,
        impact: 'high',
      });

      return { nextStep: null, scopeComplete: true };
    }

    return { nextStep, scopeComplete: false };
  }

  /**
   * Get completed scope
   */
  static getScope(sessionId: string): ProjectScope | null {
    const session = activeSessions.get(sessionId);
    return session?.context.scope || null;
  }

  // ========================================
  // PHASE MANAGEMENT
  // ========================================

  /**
   * Advance to next phase (if current phase gate is passed)
   */
  static async advancePhase(sessionId: string): Promise<{
    success: boolean;
    newPhase?: EngineeringPhase;
    reason?: string;
  }> {
    const session = activeSessions.get(sessionId);
    if (!session) return { success: false, reason: 'Session not found' };

    const { context } = session;
    const currentPhaseConfig = ENGINEERING_PHASES.find((p) => p.phase === context.currentPhase);
    if (!currentPhaseConfig) return { success: false, reason: 'Invalid current phase' };

    // Check if current phase gate is passed
    const currentGate = context.gateStatus[context.currentPhase];
    if (currentGate?.status !== 'passed') {
      return { success: false, reason: `Current phase "${currentPhaseConfig.displayName}" not yet complete` };
    }

    // Find next phase
    const currentIndex = ENGINEERING_PHASES.findIndex((p) => p.phase === context.currentPhase);
    if (currentIndex >= ENGINEERING_PHASES.length - 1) {
      return { success: false, reason: 'Already at final phase' };
    }

    const nextPhaseConfig = ENGINEERING_PHASES[currentIndex + 1];

    // Check if required inputs exist
    for (const input of nextPhaseConfig.inputsRequired) {
      if (!this.hasArtifact(context, input)) {
        return { success: false, reason: `Missing required artifact: ${input}` };
      }
    }

    // Advance to next phase
    context.currentPhase = nextPhaseConfig.phase;
    context.currentAgent = nextPhaseConfig.agent;
    context.gateStatus[nextPhaseConfig.phase] = {
      phase: nextPhaseConfig.phase,
      status: 'in_progress',
    };
    context.lastActivityAt = new Date();

    // Record agent message
    this.addMessage(session, {
      fromAgent: 'orchestrator',
      toAgent: nextPhaseConfig.agent,
      messageType: 'handoff',
      content: `Starting ${nextPhaseConfig.displayName} phase. ${nextPhaseConfig.description}`,
    });

    return { success: true, newPhase: nextPhaseConfig.phase };
  }

  /**
   * Pass the current phase gate
   */
  static async passGate(
    sessionId: string,
    artifacts: string[] = [],
    approvedBy: 'user' | 'auto' = 'auto'
  ): Promise<boolean> {
    const session = activeSessions.get(sessionId);
    if (!session) return false;

    const { context } = session;

    context.gateStatus[context.currentPhase] = {
      phase: context.currentPhase,
      status: 'passed',
      passedAt: new Date(),
      approvedBy,
      artifacts,
    };

    context.lastActivityAt = new Date();

    // Record decision
    const phaseConfig = ENGINEERING_PHASES.find((p) => p.phase === context.currentPhase);
    context.decisions.push({
      id: randomUUID(),
      timestamp: new Date(),
      agent: context.currentAgent,
      phase: context.currentPhase,
      decision: `${phaseConfig?.displayName || context.currentPhase} phase completed`,
      reasoning: `Gate passed with ${artifacts.length} artifacts`,
      alternatives: [],
      confidence: 100,
      reversible: false,
      impact: 'medium',
    });

    return true;
  }

  /**
   * Request user approval for current phase
   */
  static async requestApproval(sessionId: string, reason: string): Promise<void> {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    session.pendingApprovals.push(session.context.currentPhase);

    this.addMessage(session, {
      fromAgent: session.context.currentAgent,
      toAgent: 'user',
      messageType: 'approval',
      content: reason,
    });
  }

  /**
   * User approves or rejects current phase
   */
  static async handleApproval(
    sessionId: string,
    approved: boolean,
    feedback?: string
  ): Promise<void> {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    const { context } = session;

    // Remove from pending
    session.pendingApprovals = session.pendingApprovals.filter(
      (p) => p !== context.currentPhase
    );

    if (approved) {
      await this.passGate(sessionId, [], 'user');
    } else {
      context.gateStatus[context.currentPhase] = {
        phase: context.currentPhase,
        status: 'failed',
        failedReason: feedback || 'Rejected by user',
      };

      this.addMessage(session, {
        fromAgent: 'user',
        toAgent: context.currentAgent,
        messageType: 'rejection',
        content: feedback || 'Please revise',
      });
    }
  }

  // ========================================
  // DEPENDENCY GRAPH
  // ========================================

  /**
   * Add a node to the dependency graph
   */
  static addDependencyNode(
    sessionId: string,
    node: Omit<DependencyNode, 'id' | 'createdAt' | 'modifiedAt'>
  ): DependencyNode | null {
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    const newNode: DependencyNode = {
      id: randomUUID(),
      ...node,
      createdAt: new Date(),
      modifiedAt: new Date(),
    };

    session.context.dependencyGraph.nodes.push(newNode);
    session.context.lastActivityAt = new Date();

    return newNode;
  }

  /**
   * Add an edge to the dependency graph
   */
  static addDependencyEdge(
    sessionId: string,
    edge: Omit<DependencyEdge, 'id' | 'createdAt'>
  ): DependencyEdge | null {
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    const newEdge: DependencyEdge = {
      id: randomUUID(),
      ...edge,
      createdAt: new Date(),
    };

    session.context.dependencyGraph.edges.push(newEdge);
    return newEdge;
  }

  /**
   * Analyze impact of changing a node
   */
  static analyzeImpact(sessionId: string, nodeId: string): ImpactAnalysis | null {
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    const { nodes, edges } = session.context.dependencyGraph;
    const changedNode = nodes.find((n) => n.id === nodeId);
    if (!changedNode) return null;

    // Find directly affected (nodes that import this one)
    const directEdges = edges.filter((e) => e.targetId === nodeId);
    const directlyAffected = directEdges
      .map((e) => nodes.find((n) => n.id === e.sourceId))
      .filter((n): n is DependencyNode => n !== undefined);

    // Find transitively affected (BFS)
    const visited = new Set<string>([nodeId]);
    const queue = [...directlyAffected.map((n) => n.id)];
    const transitivelyAffected: DependencyNode[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = nodes.find((n) => n.id === currentId);
      if (current && !directlyAffected.includes(current)) {
        transitivelyAffected.push(current);
      }

      // Add nodes that depend on current
      const dependentEdges = edges.filter((e) => e.targetId === currentId);
      for (const edge of dependentEdges) {
        if (!visited.has(edge.sourceId)) {
          queue.push(edge.sourceId);
        }
      }
    }

    // Determine risk level
    const totalAffected = directlyAffected.length + transitivelyAffected.length;
    let riskLevel: ImpactAnalysis['riskLevel'] = 'low';
    if (totalAffected > 10) riskLevel = 'critical';
    else if (totalAffected > 5) riskLevel = 'high';
    else if (totalAffected > 2) riskLevel = 'medium';

    // Generate recommendations
    const recommendations: string[] = [];
    if (changedNode.type === 'schema') {
      recommendations.push('Consider running database migration');
      recommendations.push('Check all API routes that use this schema');
    }
    if (directlyAffected.some((n) => n.type === 'api')) {
      recommendations.push('API changes may require client updates');
    }
    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push('Consider creating a snapshot before making changes');
      recommendations.push('Run full test suite after changes');
    }

    return {
      changedNode,
      directlyAffected,
      transitivelyAffected,
      riskLevel,
      recommendations,
    };
  }

  /**
   * Get the full dependency graph
   */
  static getDependencyGraph(sessionId: string): DependencyGraph | null {
    const session = activeSessions.get(sessionId);
    return session?.context.dependencyGraph || null;
  }

  // ========================================
  // AGENT COMMUNICATION
  // ========================================

  /**
   * Record a decision made by an agent
   */
  static recordDecision(
    sessionId: string,
    decision: Omit<AgentDecision, 'id' | 'timestamp'>
  ): void {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    session.context.decisions.push({
      id: randomUUID(),
      timestamp: new Date(),
      ...decision,
    });
  }

  /**
   * Get decisions for review
   */
  static getDecisions(sessionId: string): AgentDecision[] {
    const session = activeSessions.get(sessionId);
    return session?.context.decisions || [];
  }

  /**
   * Get message history
   */
  static getMessages(sessionId: string): AgentMessage[] {
    const session = activeSessions.get(sessionId);
    return session?.messages || [];
  }

  // ========================================
  // ARTIFACT MANAGEMENT
  // ========================================

  /**
   * Store an artifact (PRD, tech spec, etc.)
   */
  static storeArtifact(
    sessionId: string,
    artifactType: keyof ProjectContext['artifacts'],
    content: string
  ): void {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    session.context.artifacts[artifactType] = content;
    session.context.lastActivityAt = new Date();
  }

  /**
   * Get an artifact
   */
  static getArtifact(
    sessionId: string,
    artifactType: keyof ProjectContext['artifacts']
  ): string | undefined {
    const session = activeSessions.get(sessionId);
    return session?.context.artifacts[artifactType];
  }

  // ========================================
  // AGENT PROMPTS
  // ========================================

  /**
   * Get the system prompt for the current agent
   * This is what shapes the AI's behavior for each role
   */
  static getAgentSystemPrompt(sessionId: string): string {
    const session = activeSessions.get(sessionId);
    if (!session) return '';

    const { context } = session;
    const agentConfig = AGENT_CONFIGS[context.currentAgent];
    const phaseConfig = ENGINEERING_PHASES.find((p) => p.phase === context.currentPhase);

    return `
# CodeBakers Engineering System - ${agentConfig.displayName}

${agentConfig.systemPromptAdditions}

## Current Context

**Project:** ${context.scope.name}
**Description:** ${context.scope.description}
**Phase:** ${phaseConfig?.displayName || context.currentPhase}
**Your Role:** ${agentConfig.description}

## Project Scope

- **Audience:** ${context.scope.targetAudience}
- **Platforms:** ${context.scope.platforms.join(', ')}
- **Has Auth:** ${context.scope.hasAuth ? 'Yes' : 'No'}
- **Has Payments:** ${context.scope.hasPayments ? 'Yes' : 'No'}
- **Has Realtime:** ${context.scope.hasRealtime ? 'Yes' : 'No'}
- **Is Full Business:** ${context.scope.isFullBusiness ? 'Yes' : 'No'}
${Object.entries(context.scope.compliance).filter(([, v]) => v).map(([k]) => `- **Compliance:** ${k.toUpperCase()}`).join('\n')}

## Tech Stack

- **Framework:** ${context.stack.framework}
- **Database:** ${context.stack.database}
- **ORM:** ${context.stack.orm}
- **Auth:** ${context.stack.auth}
- **UI:** ${context.stack.ui}
${context.stack.payments ? `- **Payments:** ${context.stack.payments}` : ''}

## Your Focus Areas

${agentConfig.focusAreas.map((f) => `- ${f}`).join('\n')}

## Recent Decisions

${context.decisions.slice(-5).map((d) => `- [${d.agent}] ${d.decision}`).join('\n') || 'None yet'}

## Instructions

1. Stay in character as the ${agentConfig.displayName}
2. Focus on your specific area of expertise
3. Document every decision with reasoning
4. If you need input from another agent, request it explicitly
5. When your work is complete, signal ready for gate check
`.trim();
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  private static initializeGateStatus(): Record<EngineeringPhase, GateStatus> {
    const status: Partial<Record<EngineeringPhase, GateStatus>> = {};
    for (const phase of ENGINEERING_PHASES) {
      status[phase.phase] = {
        phase: phase.phase,
        status: 'pending',
      };
    }
    return status as Record<EngineeringPhase, GateStatus>;
  }

  private static updateScopeFromAnswer(scope: ProjectScope, stepId: string, answer: unknown): void {
    switch (stepId) {
      case 'name':
        scope.name = answer as string;
        break;
      case 'description':
        scope.description = answer as string;
        break;
      case 'audience':
        scope.targetAudience = answer as ProjectScope['targetAudience'];
        break;
      case 'isFullBusiness':
        scope.isFullBusiness = answer as boolean;
        if (scope.isFullBusiness) {
          scope.needsMarketing = true;
          scope.needsAnalytics = true;
          scope.needsAdminDashboard = true;
        }
        break;
      case 'platforms':
        scope.platforms = answer as ProjectScope['platforms'];
        break;
      case 'hasAuth':
        scope.hasAuth = answer as boolean;
        break;
      case 'hasPayments':
        scope.hasPayments = answer as boolean;
        if (scope.hasPayments) {
          scope.compliance.pci = true; // PCI is implicit with payments
        }
        break;
      case 'hasRealtime':
        scope.hasRealtime = answer as boolean;
        break;
      case 'compliance':
        const complianceValues = answer as string[];
        scope.compliance = {
          hipaa: complianceValues.includes('hipaa'),
          pci: complianceValues.includes('pci') || scope.hasPayments,
          gdpr: complianceValues.includes('gdpr'),
          soc2: complianceValues.includes('soc2'),
          coppa: complianceValues.includes('coppa'),
        };
        break;
      case 'expectedUsers':
        scope.expectedUsers = answer as ProjectScope['expectedUsers'];
        break;
      case 'launchTimeline':
        scope.launchTimeline = answer as ProjectScope['launchTimeline'];
        break;
    }
  }

  private static getScopeValue(scope: ProjectScope, stepId: string): unknown {
    switch (stepId) {
      case 'name': return scope.name;
      case 'description': return scope.description;
      case 'audience': return scope.targetAudience;
      case 'isFullBusiness': return scope.isFullBusiness;
      case 'platforms': return scope.platforms;
      case 'hasAuth': return scope.hasAuth;
      case 'hasPayments': return scope.hasPayments;
      case 'hasRealtime': return scope.hasRealtime;
      case 'expectedUsers': return scope.expectedUsers;
      case 'launchTimeline': return scope.launchTimeline;
      default: return undefined;
    }
  }

  private static inferScopeDefaults(scope: ProjectScope): void {
    // If targeting businesses, likely need team features
    if (scope.targetAudience === 'businesses') {
      scope.needsTeamFeatures = true;
    }

    // Enterprise scale needs analytics and admin
    if (scope.expectedUsers === 'enterprise' || scope.expectedUsers === 'large') {
      scope.needsAnalytics = true;
      scope.needsAdminDashboard = true;
    }

    // Full business always needs these
    if (scope.isFullBusiness) {
      scope.needsMarketing = true;
      scope.needsAnalytics = true;
      scope.needsAdminDashboard = true;
    }
  }

  private static hasArtifact(context: ProjectContext, artifactName: string): boolean {
    // Check for known artifact types
    if (artifactName === 'scope.json') return context.gateStatus.scoping?.status === 'passed';
    if (artifactName === 'prd.md') return !!context.artifacts.prd;
    if (artifactName === 'tech-spec.md') return !!context.artifacts.techSpec;
    if (artifactName === 'source-code') return context.dependencyGraph.nodes.length > 0;
    if (artifactName === 'test-report.md') return true; // Would check actual tests
    if (artifactName === 'deployment-report.md') return true; // Would check deployment status

    return false;
  }

  private static addMessage(
    session: OrchestratorState,
    message: Omit<AgentMessage, 'id' | 'timestamp'>
  ): void {
    session.messages.push({
      id: randomUUID(),
      timestamp: new Date(),
      ...message,
    });
  }

  // ========================================
  // ADMIN METHODS
  // ========================================

  /**
   * Get all sessions for admin dashboard
   */
  static getAllSessions(options?: {
    status?: 'active' | 'paused' | 'completed' | 'abandoned';
    phase?: EngineeringPhase;
    page?: number;
    limit?: number;
  }): {
    sessions: Array<{
      id: string;
      teamId: string;
      projectHash: string;
      projectName: string;
      currentPhase: EngineeringPhase;
      currentAgent: AgentRole;
      status: 'active' | 'paused' | 'completed' | 'abandoned';
      startedAt: Date;
      lastActivityAt: Date;
      completedAt: Date | null;
      phaseHistory: Array<{
        phase: EngineeringPhase;
        startedAt: Date;
        completedAt: Date | null;
        agent: AgentRole;
      }>;
      decisionsCount: number;
      artifactsCount: number;
      dependencyNodesCount: number;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  } {
    const { status, phase, page = 1, limit = 25 } = options || {};

    // Convert map to array and filter
    let sessions = Array.from(activeSessions.entries()).map(([id, state]) => {
      // Determine status
      let sessionStatus: 'active' | 'paused' | 'completed' | 'abandoned' = 'active';
      if (!state.isRunning) sessionStatus = 'paused';
      if (state.context.currentPhase === 'launch' && state.context.gateStatus.launch?.status === 'passed') {
        sessionStatus = 'completed';
      }
      // Check for abandoned (no activity for 7 days)
      const daysSinceActivity = (Date.now() - state.context.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity > 7 && sessionStatus !== 'completed') {
        sessionStatus = 'abandoned';
      }

      // Build phase history from gate statuses
      const phaseHistory: Array<{
        phase: EngineeringPhase;
        startedAt: Date;
        completedAt: Date | null;
        agent: AgentRole;
      }> = [];

      const phases: EngineeringPhase[] = [
        'scoping', 'requirements', 'architecture', 'design_review', 'implementation',
        'code_review', 'testing', 'security_review', 'documentation', 'staging', 'launch'
      ];

      for (const p of phases) {
        const gateStatus = state.context.gateStatus[p];
        if (gateStatus) {
          phaseHistory.push({
            phase: p,
            startedAt: state.context.startedAt, // Simplified - would track per phase
            completedAt: gateStatus.status === 'passed' ? gateStatus.passedAt || null : null,
            agent: ENGINEERING_PHASES.find(ep => ep.phase === p)?.agent || 'orchestrator',
          });
        }
      }

      // Count artifacts
      let artifactsCount = 0;
      if (state.context.artifacts.prd) artifactsCount++;
      if (state.context.artifacts.techSpec) artifactsCount++;
      if (state.context.artifacts.apiDocs) artifactsCount++;
      if (state.context.artifacts.securityAudit) artifactsCount++;
      if (state.context.artifacts.userGuide) artifactsCount++;
      if (state.context.artifacts.deploymentGuide) artifactsCount++;

      return {
        id,
        teamId: state.context.teamId,
        projectHash: state.context.projectHash,
        projectName: state.context.scope.name,
        currentPhase: state.context.currentPhase,
        currentAgent: state.currentAgent,
        status: sessionStatus,
        startedAt: state.context.startedAt,
        lastActivityAt: state.context.lastActivityAt,
        completedAt: sessionStatus === 'completed' ? state.context.lastActivityAt : null,
        phaseHistory,
        decisionsCount: state.context.decisions.length,
        artifactsCount,
        dependencyNodesCount: state.context.dependencyGraph.nodes.length,
      };
    });

    // Apply filters
    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }
    if (phase) {
      sessions = sessions.filter(s => s.currentPhase === phase);
    }

    // Sort by last activity (most recent first)
    sessions.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    // Paginate
    const total = sessions.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedSessions = sessions.slice(offset, offset + limit);

    return {
      sessions: paginatedSessions,
      pagination: { page, limit, total, pages },
    };
  }

  /**
   * Get engineering stats for admin dashboard
   */
  static getStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    pausedSessions: number;
    abandonedSessions: number;
    sessionsToday: number;
    sessionsThisWeek: number;
    averageCompletionTime: number;
    phaseDistribution: Record<string, number>;
    agentUsage: Record<string, number>;
  } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    let activeCount = 0;
    let completedCount = 0;
    let pausedCount = 0;
    let abandonedCount = 0;
    let todayCount = 0;
    let weekCount = 0;
    const completionTimes: number[] = [];
    const phaseDistribution: Record<string, number> = {};
    const agentUsage: Record<string, number> = {};

    for (const [, state] of activeSessions) {
      // Count by status
      if (!state.isRunning) {
        pausedCount++;
      } else if (state.context.currentPhase === 'launch' && state.context.gateStatus.launch?.status === 'passed') {
        completedCount++;
        // Calculate completion time
        const completionTime = state.context.lastActivityAt.getTime() - state.context.startedAt.getTime();
        completionTimes.push(completionTime / (1000 * 60)); // Convert to minutes
      } else {
        const daysSinceActivity = (now.getTime() - state.context.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity > 7) {
          abandonedCount++;
        } else {
          activeCount++;
        }
      }

      // Count sessions by time
      if (state.context.startedAt >= todayStart) {
        todayCount++;
      }
      if (state.context.startedAt >= weekStart) {
        weekCount++;
      }

      // Track phase distribution (only active sessions)
      if (state.isRunning) {
        phaseDistribution[state.context.currentPhase] = (phaseDistribution[state.context.currentPhase] || 0) + 1;
        agentUsage[state.currentAgent] = (agentUsage[state.currentAgent] || 0) + 1;
      }
    }

    // Calculate average completion time
    const averageCompletionTime = completionTimes.length > 0
      ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
      : 0;

    return {
      totalSessions: activeSessions.size,
      activeSessions: activeCount,
      completedSessions: completedCount,
      pausedSessions: pausedCount,
      abandonedSessions: abandonedCount,
      sessionsToday: todayCount,
      sessionsThisWeek: weekCount,
      averageCompletionTime,
      phaseDistribution,
      agentUsage,
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Quick start helper - creates session and returns first step
 */
export async function startEngineeringBuild(
  teamId: string,
  projectHash: string,
  projectName: string
) {
  return EngineeringOrchestratorService.startSession(teamId, projectHash, projectName);
}

/**
 * Get current build progress
 */
export function getEngineeringProgress(sessionId: string) {
  return EngineeringOrchestratorService.getProgress(sessionId);
}

/**
 * Analyze impact before making changes
 */
export function analyzeChangeImpact(sessionId: string, nodeId: string) {
  return EngineeringOrchestratorService.analyzeImpact(sessionId, nodeId);
}
