/**
 * ENGINEERING STATE PERSISTENCE
 *
 * Manages the .codebakers/ folder structure for local state persistence.
 * This keeps the project state in sync between local and server.
 *
 * Folder structure:
 * .codebakers/
 *   project.json       - Main project configuration and scope
 *   state.json         - Current build state (phase, progress, etc.)
 *   graph.json         - Dependency graph
 *   decisions/         - Agent decision log
 *     001-scoping.json
 *     002-architecture.json
 *   artifacts/         - Generated documents
 *     prd.md
 *     tech-spec.md
 *     api-docs.md
 *   messages/          - Agent communication log
 *     session-xxx.json
 *   snapshots/         - Rollback points
 *     snap-001/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectConfig {
  // Identity
  id: string;
  name: string;
  description: string;
  projectHash: string;

  // Scope
  scope: ProjectScope;

  // Stack (locked after first detection)
  stack: StackConfig;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ProjectScope {
  targetAudience: 'consumers' | 'businesses' | 'internal' | 'developers';
  isFullBusiness: boolean;
  needsMarketing: boolean;
  needsAnalytics: boolean;
  needsTeamFeatures: boolean;
  needsAdminDashboard: boolean;
  platforms: ('web' | 'mobile' | 'api')[];
  hasRealtime: boolean;
  hasPayments: boolean;
  hasAuth: boolean;
  hasFileUploads: boolean;
  compliance: {
    hipaa: boolean;
    pci: boolean;
    gdpr: boolean;
    soc2: boolean;
    coppa: boolean;
  };
  expectedUsers: 'small' | 'medium' | 'large' | 'enterprise';
  launchTimeline: 'asap' | 'weeks' | 'months' | 'flexible';
}

export interface StackConfig {
  framework: string;
  database: string;
  orm: string;
  auth: string;
  ui: string;
  payments?: string;
}

export interface BuildState {
  // Current status
  sessionId: string | null;
  currentPhase: EngineeringPhase;
  currentAgent: AgentRole;
  isRunning: boolean;

  // Gate status for each phase
  gates: Record<EngineeringPhase, GateStatus>;

  // Progress
  overallProgress: number;
  lastActivity: string; // ISO timestamp

  // Pending items
  pendingApprovals: string[];
  blockers: string[];
}

export type EngineeringPhase =
  | 'scoping'
  | 'requirements'
  | 'architecture'
  | 'design_review'
  | 'implementation'
  | 'code_review'
  | 'testing'
  | 'security_review'
  | 'documentation'
  | 'staging'
  | 'launch';

export type AgentRole =
  | 'orchestrator'
  | 'pm'
  | 'architect'
  | 'engineer'
  | 'qa'
  | 'security'
  | 'documentation'
  | 'devops';

export interface GateStatus {
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
  passedAt?: string;
  failedReason?: string;
  approvedBy?: string;
  artifacts?: string[];
}

export interface DependencyNode {
  id: string;
  type: 'schema' | 'api' | 'component' | 'service' | 'page' | 'util' | 'config';
  name: string;
  filePath: string;
  createdAt: string;
  modifiedAt: string;
  createdByFeature?: string;
}

export interface DependencyEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'import' | 'api-call' | 'db-query' | 'event' | 'config';
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface AgentDecision {
  id: string;
  timestamp: string;
  agent: AgentRole;
  phase: EngineeringPhase;
  decision: string;
  reasoning: string;
  alternatives: string[];
  confidence: number;
  reversible: boolean;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgentMessage {
  id: string;
  timestamp: string;
  fromAgent: AgentRole | 'user';
  toAgent: AgentRole | 'user' | 'all';
  messageType: 'request' | 'response' | 'review' | 'approval' | 'rejection' | 'question' | 'update' | 'handoff';
  content: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// STATE MANAGER
// =============================================================================

export class EngineeringStateManager {
  private cwd: string;
  private stateDir: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.stateDir = join(cwd, '.codebakers');
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize the .codebakers folder structure
   */
  init(): void {
    // Create main directory
    if (!existsSync(this.stateDir)) {
      mkdirSync(this.stateDir, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ['decisions', 'artifacts', 'messages', 'snapshots'];
    for (const subdir of subdirs) {
      const path = join(this.stateDir, subdir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
  }

  /**
   * Check if project is initialized
   */
  isInitialized(): boolean {
    return existsSync(join(this.stateDir, 'project.json'));
  }

  /**
   * Get project hash from current directory
   */
  getProjectHash(): string {
    // Try to get git remote first
    try {
      const gitDir = join(this.cwd, '.git');
      if (existsSync(gitDir)) {
        const configPath = join(gitDir, 'config');
        if (existsSync(configPath)) {
          const config = readFileSync(configPath, 'utf-8');
          const remoteMatch = config.match(/url = (.+)/);
          if (remoteMatch) {
            return createHash('sha256').update(remoteMatch[1]).digest('hex').slice(0, 16);
          }
        }
      }
    } catch {
      // Ignore git errors
    }

    // Fall back to directory path hash
    return createHash('sha256').update(this.cwd).digest('hex').slice(0, 16);
  }

  // ========================================
  // PROJECT CONFIG
  // ========================================

  /**
   * Create a new project configuration
   */
  createProject(name: string, description: string, scope: Partial<ProjectScope> = {}): ProjectConfig {
    this.init();

    const defaultScope: ProjectScope = {
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
    };

    const project: ProjectConfig = {
      id: createHash('sha256').update(Date.now().toString() + Math.random()).digest('hex').slice(0, 16),
      name,
      description,
      projectHash: this.getProjectHash(),
      scope: { ...defaultScope, ...scope },
      stack: this.detectStack(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveProject(project);
    this.initializeState();

    return project;
  }

  /**
   * Get project configuration
   */
  getProject(): ProjectConfig | null {
    const path = join(this.stateDir, 'project.json');
    if (!existsSync(path)) return null;

    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Save project configuration
   */
  saveProject(project: ProjectConfig): void {
    project.updatedAt = new Date().toISOString();
    writeFileSync(
      join(this.stateDir, 'project.json'),
      JSON.stringify(project, null, 2)
    );
  }

  /**
   * Update project scope
   */
  updateScope(scope: Partial<ProjectScope>): ProjectConfig | null {
    const project = this.getProject();
    if (!project) return null;

    project.scope = { ...project.scope, ...scope };
    this.saveProject(project);

    return project;
  }

  // ========================================
  // BUILD STATE
  // ========================================

  /**
   * Initialize build state
   */
  private initializeState(): void {
    const initialGates: Record<EngineeringPhase, GateStatus> = {
      scoping: { status: 'pending' },
      requirements: { status: 'pending' },
      architecture: { status: 'pending' },
      design_review: { status: 'pending' },
      implementation: { status: 'pending' },
      code_review: { status: 'pending' },
      testing: { status: 'pending' },
      security_review: { status: 'pending' },
      documentation: { status: 'pending' },
      staging: { status: 'pending' },
      launch: { status: 'pending' },
    };

    const state: BuildState = {
      sessionId: null,
      currentPhase: 'scoping',
      currentAgent: 'orchestrator',
      isRunning: false,
      gates: initialGates,
      overallProgress: 0,
      lastActivity: new Date().toISOString(),
      pendingApprovals: [],
      blockers: [],
    };

    this.saveState(state);
  }

  /**
   * Get build state
   */
  getState(): BuildState | null {
    const path = join(this.stateDir, 'state.json');
    if (!existsSync(path)) return null;

    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Save build state
   */
  saveState(state: BuildState): void {
    state.lastActivity = new Date().toISOString();
    writeFileSync(
      join(this.stateDir, 'state.json'),
      JSON.stringify(state, null, 2)
    );
  }

  /**
   * Update current phase
   */
  setPhase(phase: EngineeringPhase, agent: AgentRole): void {
    const state = this.getState();
    if (!state) return;

    state.currentPhase = phase;
    state.currentAgent = agent;
    state.gates[phase] = { status: 'in_progress' };

    this.saveState(state);
  }

  /**
   * Pass a gate
   */
  passGate(phase: EngineeringPhase, artifacts: string[] = [], approvedBy = 'auto'): void {
    const state = this.getState();
    if (!state) return;

    state.gates[phase] = {
      status: 'passed',
      passedAt: new Date().toISOString(),
      approvedBy,
      artifacts,
    };

    // Calculate progress
    const phases = Object.keys(state.gates) as EngineeringPhase[];
    const passed = phases.filter(p => state.gates[p].status === 'passed').length;
    state.overallProgress = Math.round((passed / phases.length) * 100);

    this.saveState(state);
  }

  /**
   * Fail a gate
   */
  failGate(phase: EngineeringPhase, reason: string): void {
    const state = this.getState();
    if (!state) return;

    state.gates[phase] = {
      status: 'failed',
      failedReason: reason,
    };

    this.saveState(state);
  }

  // ========================================
  // DEPENDENCY GRAPH
  // ========================================

  /**
   * Get dependency graph
   */
  getGraph(): DependencyGraph {
    const path = join(this.stateDir, 'graph.json');
    if (!existsSync(path)) {
      return { nodes: [], edges: [] };
    }

    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Save dependency graph
   */
  saveGraph(graph: DependencyGraph): void {
    writeFileSync(
      join(this.stateDir, 'graph.json'),
      JSON.stringify(graph, null, 2)
    );
  }

  /**
   * Add a node to the graph
   */
  addNode(node: Omit<DependencyNode, 'id' | 'createdAt' | 'modifiedAt'>): DependencyNode {
    const graph = this.getGraph();

    const newNode: DependencyNode = {
      id: createHash('sha256').update(node.filePath + Date.now()).digest('hex').slice(0, 12),
      ...node,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    // Check if node with same path already exists
    const existingIndex = graph.nodes.findIndex(n => n.filePath === node.filePath);
    if (existingIndex >= 0) {
      graph.nodes[existingIndex] = {
        ...graph.nodes[existingIndex],
        ...newNode,
        id: graph.nodes[existingIndex].id, // Keep original ID
        createdAt: graph.nodes[existingIndex].createdAt,
      };
    } else {
      graph.nodes.push(newNode);
    }

    this.saveGraph(graph);
    return newNode;
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: Omit<DependencyEdge, 'id'>): DependencyEdge {
    const graph = this.getGraph();

    // Check if edge already exists
    const exists = graph.edges.some(
      e => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.type === edge.type
    );
    if (exists) {
      return graph.edges.find(
        e => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.type === edge.type
      )!;
    }

    const newEdge: DependencyEdge = {
      id: createHash('sha256').update(edge.sourceId + edge.targetId + Date.now()).digest('hex').slice(0, 12),
      ...edge,
    };

    graph.edges.push(newEdge);
    this.saveGraph(graph);

    return newEdge;
  }

  /**
   * Find nodes affected by a change
   */
  findAffectedNodes(nodeId: string): { direct: DependencyNode[]; transitive: DependencyNode[] } {
    const graph = this.getGraph();

    // Find direct dependents (nodes that import this one)
    const directEdges = graph.edges.filter(e => e.targetId === nodeId);
    const direct = directEdges
      .map(e => graph.nodes.find(n => n.id === e.sourceId))
      .filter((n): n is DependencyNode => n !== undefined);

    // Find transitive dependents (BFS)
    const visited = new Set<string>([nodeId]);
    const queue = [...direct.map(n => n.id)];
    const transitive: DependencyNode[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const current = graph.nodes.find(n => n.id === currentId);
      if (current && !direct.includes(current)) {
        transitive.push(current);
      }

      // Add nodes that depend on current
      const dependentEdges = graph.edges.filter(e => e.targetId === currentId);
      for (const edge of dependentEdges) {
        if (!visited.has(edge.sourceId)) {
          queue.push(edge.sourceId);
        }
      }
    }

    return { direct, transitive };
  }

  // ========================================
  // DECISIONS
  // ========================================

  /**
   * Record a decision
   */
  recordDecision(decision: Omit<AgentDecision, 'id' | 'timestamp'>): AgentDecision {
    const decisionsDir = join(this.stateDir, 'decisions');
    const files = existsSync(decisionsDir) ? readdirSync(decisionsDir) : [];
    const index = String(files.length + 1).padStart(3, '0');

    const fullDecision: AgentDecision = {
      id: createHash('sha256').update(Date.now().toString() + Math.random()).digest('hex').slice(0, 12),
      timestamp: new Date().toISOString(),
      ...decision,
    };

    const filename = `${index}-${decision.phase}.json`;
    writeFileSync(
      join(decisionsDir, filename),
      JSON.stringify(fullDecision, null, 2)
    );

    return fullDecision;
  }

  /**
   * Get all decisions
   */
  getDecisions(): AgentDecision[] {
    const decisionsDir = join(this.stateDir, 'decisions');
    if (!existsSync(decisionsDir)) return [];

    const files = readdirSync(decisionsDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        return JSON.parse(readFileSync(join(decisionsDir, f), 'utf-8'));
      } catch {
        return null;
      }
    }).filter((d): d is AgentDecision => d !== null);
  }

  // ========================================
  // ARTIFACTS
  // ========================================

  /**
   * Save an artifact (PRD, tech spec, etc.)
   */
  saveArtifact(name: string, content: string): void {
    writeFileSync(
      join(this.stateDir, 'artifacts', name),
      content
    );
  }

  /**
   * Get an artifact
   */
  getArtifact(name: string): string | null {
    const path = join(this.stateDir, 'artifacts', name);
    if (!existsSync(path)) return null;

    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * List all artifacts
   */
  listArtifacts(): string[] {
    const artifactsDir = join(this.stateDir, 'artifacts');
    if (!existsSync(artifactsDir)) return [];

    return readdirSync(artifactsDir);
  }

  // ========================================
  // MESSAGES
  // ========================================

  /**
   * Record a message
   */
  recordMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const state = this.getState();
    const sessionId = state?.sessionId || 'default';

    const messagesPath = join(this.stateDir, 'messages', `${sessionId}.json`);
    let messages: AgentMessage[] = [];

    if (existsSync(messagesPath)) {
      try {
        messages = JSON.parse(readFileSync(messagesPath, 'utf-8'));
      } catch {
        messages = [];
      }
    }

    const fullMessage: AgentMessage = {
      id: createHash('sha256').update(Date.now().toString() + Math.random()).digest('hex').slice(0, 12),
      timestamp: new Date().toISOString(),
      ...message,
    };

    messages.push(fullMessage);
    writeFileSync(messagesPath, JSON.stringify(messages, null, 2));

    return fullMessage;
  }

  /**
   * Get messages for current session
   */
  getMessages(): AgentMessage[] {
    const state = this.getState();
    const sessionId = state?.sessionId || 'default';

    const messagesPath = join(this.stateDir, 'messages', `${sessionId}.json`);
    if (!existsSync(messagesPath)) return [];

    try {
      return JSON.parse(readFileSync(messagesPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  // ========================================
  // STACK DETECTION
  // ========================================

  /**
   * Detect the tech stack from package.json
   */
  private detectStack(): StackConfig {
    const stack: StackConfig = {
      framework: 'nextjs',
      database: 'supabase',
      orm: 'drizzle',
      auth: 'supabase',
      ui: 'shadcn',
    };

    const packageJsonPath = join(this.cwd, 'package.json');
    if (!existsSync(packageJsonPath)) return stack;

    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Framework detection
      if (deps['next']) stack.framework = 'nextjs';
      else if (deps['@remix-run/react']) stack.framework = 'remix';
      else if (deps['react']) stack.framework = 'react';
      else if (deps['vue']) stack.framework = 'vue';
      else if (deps['svelte']) stack.framework = 'svelte';

      // ORM detection
      if (deps['drizzle-orm']) stack.orm = 'drizzle';
      else if (deps['prisma']) stack.orm = 'prisma';
      else if (deps['typeorm']) stack.orm = 'typeorm';
      else if (deps['mongoose']) stack.orm = 'mongoose';

      // Database detection
      if (deps['@supabase/supabase-js']) stack.database = 'supabase';
      else if (deps['@planetscale/database']) stack.database = 'planetscale';
      else if (deps['firebase']) stack.database = 'firebase';
      else if (deps['pg']) stack.database = 'postgres';
      else if (deps['mysql2']) stack.database = 'mysql';
      else if (deps['mongodb']) stack.database = 'mongodb';

      // Auth detection
      if (deps['@supabase/auth-helpers-nextjs'] || deps['@supabase/supabase-js']) stack.auth = 'supabase';
      else if (deps['@clerk/nextjs']) stack.auth = 'clerk';
      else if (deps['next-auth']) stack.auth = 'next-auth';
      else if (deps['@auth/core']) stack.auth = 'authjs';
      else if (deps['firebase']) stack.auth = 'firebase';

      // UI detection
      if (deps['@radix-ui/react-slot'] || existsSync(join(this.cwd, 'components', 'ui'))) stack.ui = 'shadcn';
      else if (deps['@chakra-ui/react']) stack.ui = 'chakra';
      else if (deps['@mui/material']) stack.ui = 'mui';
      else if (deps['antd']) stack.ui = 'antd';

      // Payments detection
      if (deps['stripe']) stack.payments = 'stripe';
      else if (deps['@paypal/react-paypal-js']) stack.payments = 'paypal';
      else if (deps['square']) stack.payments = 'square';
    } catch {
      // Return default stack on error
    }

    return stack;
  }

  // ========================================
  // SUMMARY
  // ========================================

  /**
   * Get a summary of current engineering state
   */
  getSummary(): {
    project: ProjectConfig | null;
    state: BuildState | null;
    graphStats: { nodes: number; edges: number };
    decisions: number;
    artifacts: string[];
  } {
    const graph = this.getGraph();

    return {
      project: this.getProject(),
      state: this.getState(),
      graphStats: { nodes: graph.nodes.length, edges: graph.edges.length },
      decisions: this.getDecisions().length,
      artifacts: this.listArtifacts(),
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get the state manager for current directory
 */
export function getStateManager(cwd?: string): EngineeringStateManager {
  return new EngineeringStateManager(cwd);
}

/**
 * Check if engineering project exists in current directory
 */
export function hasEngineeringProject(cwd?: string): boolean {
  return getStateManager(cwd).isInitialized();
}

/**
 * Quick summary of current project state
 */
export function getProjectSummary(cwd?: string) {
  return getStateManager(cwd).getSummary();
}
