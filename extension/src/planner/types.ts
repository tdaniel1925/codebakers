/**
 * Interactive AI Build Planner Types
 *
 * This module defines types for the collaborative AI-driven build planning system.
 * Unlike the Mind Map (which analyzes existing code), the Build Planner helps
 * users design and generate new architectures with AI assistance.
 */

// ============================================================================
// Node Types - The building blocks of a plan
// ============================================================================

export type PlanNodeType =
  | 'page'           // Next.js page/route
  | 'component'      // React component
  | 'api'            // API route
  | 'database'       // Database table/model
  | 'type'           // TypeScript type/interface
  | 'hook'           // React hook
  | 'service'        // Service/utility module
  | 'middleware'     // Middleware function
  | 'context'        // React context provider
  | 'action'         // Server action
  | 'job';           // Background job/cron

export interface PlanNodePosition {
  x: number;
  y: number;
}

export interface PlanNodeField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface PlanNodeMethod {
  name: string;
  params: string;
  returnType: string;
  description?: string;
  isAsync: boolean;
}

export interface PlanNodeDetails {
  // Page-specific
  route?: string;
  isProtected?: boolean;
  layout?: string;

  // Component-specific
  props?: PlanNodeField[];
  hasState?: boolean;

  // API-specific
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requestBody?: PlanNodeField[];
  responseType?: string;
  requiresAuth?: boolean;

  // Database-specific
  tableName?: string;
  columns?: PlanNodeField[];
  relations?: {
    target: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
    foreignKey?: string;
  }[];

  // Type-specific
  fields?: PlanNodeField[];
  extends?: string;

  // Hook-specific
  dependencies?: string[];
  returnValue?: string;

  // Service-specific
  methods?: PlanNodeMethod[];

  // Action-specific
  formFields?: PlanNodeField[];

  // Job-specific
  schedule?: string;
  trigger?: string;
}

export interface PlanNode {
  id: string;
  type: PlanNodeType;
  name: string;
  description: string;
  position: PlanNodePosition;
  details: PlanNodeDetails;
  status: 'draft' | 'ai-suggested' | 'approved' | 'generated';
  aiGenerated: boolean;
  aiNotes?: string;    // AI explanation of why this node was suggested
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Edge Types - Connections between nodes
// ============================================================================

export type EdgeType =
  | 'imports'        // A imports B
  | 'renders'        // Page/Component renders Component
  | 'calls'          // Component/Page calls API/Service
  | 'uses'           // Uses a hook/context
  | 'queries'        // API/Service queries Database
  | 'mutates'        // API/Service mutates Database
  | 'extends'        // Type extends another type
  | 'triggers'       // Action triggers Job
  | 'provides';      // Context provides data

export interface PlanEdge {
  id: string;
  source: string;      // Node ID
  target: string;      // Node ID
  type: EdgeType;
  label?: string;
  aiGenerated: boolean;
  aiNotes?: string;
}

// ============================================================================
// AI Conversation Types
// ============================================================================

export type AIMessageRole = 'user' | 'assistant' | 'system';

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  timestamp: number;

  // Actions the AI suggests in this message
  suggestedActions?: AISuggestedAction[];

  // If this message resulted in changes
  appliedChanges?: {
    nodesAdded?: string[];
    nodesModified?: string[];
    nodesRemoved?: string[];
    edgesAdded?: string[];
    edgesRemoved?: string[];
  };
}

export interface AISuggestedAction {
  id: string;
  type: 'add-node' | 'add-edge' | 'modify-node' | 'remove-node' | 'use-template' | 'generate';
  label: string;
  description: string;
  payload: any;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AISuggestion {
  id: string;
  type: 'missing-piece' | 'improvement' | 'warning' | 'question';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  suggestedNodes?: Partial<PlanNode>[];
  suggestedEdges?: Partial<PlanEdge>[];
  dismissed: boolean;
  createdAt: number;
}

// ============================================================================
// Plan Templates
// ============================================================================

export type TemplateCategory =
  | 'saas'
  | 'ecommerce'
  | 'dashboard'
  | 'blog'
  | 'api'
  | 'mobile-backend'
  | 'custom';

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  nodes: Omit<PlanNode, 'id' | 'createdAt' | 'updatedAt'>[];
  edges: Omit<PlanEdge, 'id'>[];
  tags: string[];
}

// ============================================================================
// Plan State - The complete plan
// ============================================================================

export type PlanStatus =
  | 'planning'       // User is still designing
  | 'reviewing'      // AI is reviewing for completeness
  | 'approved'       // Ready to generate
  | 'generating'     // Code generation in progress
  | 'completed';     // All code generated

export interface Plan {
  id: string;
  name: string;
  description: string;
  status: PlanStatus;

  // The architecture
  nodes: PlanNode[];
  edges: PlanEdge[];

  // AI conversation history
  messages: AIMessage[];

  // Active AI suggestions
  suggestions: AISuggestion[];

  // Template used (if any)
  templateId?: string;

  // Generation tracking
  generatedFiles?: GeneratedFile[];

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Viewport state for persistence
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// ============================================================================
// Code Generation Types
// ============================================================================

export interface GeneratedFile {
  path: string;
  content: string;
  nodeId: string;
  status: 'pending' | 'written' | 'error';
  error?: string;
}

export interface GenerationRequest {
  planId: string;
  nodes: string[];        // Node IDs to generate (or all if empty)
  dryRun: boolean;        // Preview without writing
  usePatterns: boolean;   // Use CodeBakers patterns
}

export interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors: { nodeId: string; error: string }[];
  duration: number;
}

// ============================================================================
// Canvas Interaction Types
// ============================================================================

export type CanvasMode =
  | 'select'
  | 'pan'
  | 'add-node'
  | 'add-edge'
  | 'delete';

export interface CanvasState {
  mode: CanvasMode;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  dragState: {
    isDragging: boolean;
    nodeId: string | null;
    startPosition: PlanNodePosition | null;
  };
  connectionState: {
    isConnecting: boolean;
    sourceNodeId: string | null;
    tempEndpoint: PlanNodePosition | null;
  };
}

// ============================================================================
// WebView Messages
// ============================================================================

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'chat'; content: string }
  | { type: 'add-node'; nodeType: PlanNodeType; position: PlanNodePosition }
  | { type: 'update-node'; nodeId: string; updates: Partial<PlanNode> }
  | { type: 'delete-node'; nodeId: string }
  | { type: 'add-edge'; source: string; target: string; edgeType: EdgeType }
  | { type: 'delete-edge'; edgeId: string }
  | { type: 'accept-suggestion'; suggestionId: string }
  | { type: 'dismiss-suggestion'; suggestionId: string }
  | { type: 'accept-action'; actionId: string }
  | { type: 'reject-action'; actionId: string }
  | { type: 'use-template'; templateId: string }
  | { type: 'generate'; request: GenerationRequest }
  | { type: 'save-plan' }
  | { type: 'load-plan'; planId: string }
  | { type: 'new-plan' }
  | { type: 'update-viewport'; viewport: Plan['viewport'] }
  | { type: 'request-ai-review' }
  | { type: 'run-tests' };

export type ExtensionToWebviewMessage =
  | { type: 'init'; plan: Plan; templates: PlanTemplate[] }
  | { type: 'plan-updated'; plan: Plan }
  | { type: 'ai-message'; message: AIMessage }
  | { type: 'ai-typing'; isTyping: boolean }
  | { type: 'suggestion-added'; suggestion: AISuggestion }
  | { type: 'suggestion-removed'; suggestionId: string }
  | { type: 'generation-started'; nodeIds: string[] }
  | { type: 'generation-progress'; nodeId: string; status: 'generating' | 'done' | 'error'; file?: GeneratedFile }
  | { type: 'generation-completed'; result: GenerationResult }
  | { type: 'error'; message: string };

// ============================================================================
// AI Planner Configuration
// ============================================================================

export interface AIPlannerConfig {
  // How proactive should the AI be?
  proactivityLevel: 'minimal' | 'balanced' | 'aggressive';

  // Should AI auto-suggest edges when nodes are added?
  autoSuggestConnections: boolean;

  // Should AI warn about missing common patterns?
  warnMissingPatterns: boolean;

  // Project context for smarter suggestions
  projectType?: 'nextjs' | 'react' | 'node' | 'fullstack';

  // Existing patterns to use during generation
  patterns: string[];
}

// ============================================================================
// Node Creation Defaults
// ============================================================================

export const NODE_DEFAULTS: Record<PlanNodeType, Partial<PlanNode>> = {
  page: {
    type: 'page',
    description: 'A screen users can visit. Like the homepage, login page, or dashboard. Each page has its own URL (e.g., /about, /settings).',
    details: {
      route: '/',
      isProtected: false,
    },
  },
  component: {
    type: 'component',
    description: 'A reusable building block for your pages. Like a button, card, or navigation bar. Build once, use anywhere.',
    details: {
      props: [],
      hasState: false,
    },
  },
  api: {
    type: 'api',
    description: 'A backend endpoint that handles data. When users submit a form, log in, or load their profile, an API handles it behind the scenes.',
    details: {
      httpMethod: 'GET',
      requestBody: [],
      requiresAuth: true,
    },
  },
  database: {
    type: 'database',
    description: 'A table to store your data permanently. Like a spreadsheet that saves users, orders, or posts. Your app reads from and writes to this.',
    details: {
      columns: [],
      relations: [],
    },
  },
  type: {
    type: 'type',
    description: 'A blueprint that defines the shape of your data. Like saying "a User has a name, email, and age". Helps prevent bugs.',
    details: {
      fields: [],
    },
  },
  hook: {
    type: 'hook',
    description: 'Reusable logic for your components. Like "fetch user data" or "track form input". Write the logic once, use it in any component.',
    details: {
      dependencies: [],
    },
  },
  service: {
    type: 'service',
    description: 'A helper module that does a specific job. Like sending emails, processing payments, or talking to external services. Keeps your code organized.',
    details: {
      methods: [],
    },
  },
  middleware: {
    type: 'middleware',
    description: 'A security checkpoint that runs before pages load. Checks if users are logged in, have permission, or blocks bad requests.',
    details: {},
  },
  context: {
    type: 'context',
    description: 'Shared data that many components can access. Like the current user, theme (dark/light), or language. No need to pass it manually everywhere.',
    details: {},
  },
  action: {
    type: 'action',
    description: 'A function that runs on the server when users submit forms. Handles things like creating posts, updating profiles, or processing orders securely.',
    details: {
      formFields: [],
    },
  },
  job: {
    type: 'job',
    description: 'A task that runs automatically in the background. Like sending weekly emails, cleaning up old data, or syncing with other services.',
    details: {},
  },
};

// ============================================================================
// Node Colors for UI
// ============================================================================

export const NODE_COLORS: Record<PlanNodeType, { bg: string; border: string; icon: string }> = {
  page: { bg: '#dbeafe', border: '#3b82f6', icon: '📄' },
  component: { bg: '#dcfce7', border: '#22c55e', icon: '🧩' },
  api: { bg: '#fef3c7', border: '#f59e0b', icon: '🔌' },
  database: { bg: '#fce7f3', border: '#ec4899', icon: '🗄️' },
  type: { bg: '#e0e7ff', border: '#6366f1', icon: '📝' },
  hook: { bg: '#f3e8ff', border: '#a855f7', icon: '🪝' },
  service: { bg: '#ccfbf1', border: '#14b8a6', icon: '⚙️' },
  middleware: { bg: '#fed7aa', border: '#f97316', icon: '🔀' },
  context: { bg: '#cffafe', border: '#06b6d4', icon: '🌐' },
  action: { bg: '#fecaca', border: '#ef4444', icon: '⚡' },
  job: { bg: '#e5e7eb', border: '#6b7280', icon: '⏰' },
};
