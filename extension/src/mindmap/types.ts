/**
 * Mind Map Types - Core type definitions for the CodeBakers Mind Map feature
 */

// ==================== NODE TYPES ====================

export type NodeType =
  | 'file'
  | 'component'
  | 'function'
  | 'type'
  | 'interface'
  | 'api'
  | 'hook'
  | 'context'
  | 'class'
  | 'enum'
  | 'constant'
  | 'database'
  | 'external';

export interface CodeNode {
  id: string;
  type: NodeType;
  name: string;
  path: string;
  line?: number;
  position: { x: number; y: number };

  // Code details
  exports?: ExportInfo[];
  imports?: ImportInfo[];
  fields?: FieldInfo[];
  props?: PropInfo[];
  methods?: MethodInfo[];
  hooks?: string[];

  // Metadata
  linesOfCode?: number;
  complexity?: number;
  lastModified?: string;

  // UI state
  collapsed?: boolean;
  highlighted?: boolean;
  style?: NodeStyle;
}

export interface NodeStyle {
  color?: string;
  borderColor?: string;
  backgroundColor?: string;
  icon?: string;
}

// ==================== EDGE TYPES ====================

export type EdgeType =
  | 'imports'
  | 'exports'
  | 'calls'
  | 'extends'
  | 'implements'
  | 'uses_type'
  | 'renders'
  | 'provides_context'
  | 'consumes_context'
  | 'has_field'
  | 'references';

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  weight?: number; // How critical is this connection? 1-10
  style?: EdgeStyle;
}

export interface EdgeStyle {
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
  dashed?: boolean;
}

// ==================== CODE DETAILS ====================

export interface ExportInfo {
  name: string;
  type: 'default' | 'named' | 'type' | 'interface';
  line: number;
}

export interface ImportInfo {
  name: string;
  from: string;
  type: 'default' | 'named' | 'namespace' | 'type';
  line: number;
  resolvedPath?: string;
}

export interface FieldInfo {
  name: string;
  type: string;
  optional: boolean;
  line?: number;
}

export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

export interface MethodInfo {
  name: string;
  params: string[];
  returnType: string;
  async: boolean;
  line: number;
}

// ==================== GRAPH ====================

export interface DependencyGraphData {
  nodes: CodeNode[];
  edges: Edge[];
  groups?: NodeGroup[];
  metadata: GraphMetadata;
}

export interface NodeGroup {
  id: string;
  name: string;
  nodeIds: string[];
  color?: string;
  collapsed?: boolean;
}

export interface GraphMetadata {
  projectName: string;
  projectPath: string;
  analyzedAt: string;
  totalFiles: number;
  totalNodes: number;
  totalEdges: number;
  coherenceScore: number;
  issues: CoherenceIssue[];
}

// ==================== COHERENCE ====================

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CoherenceIssue {
  id: string;
  type:
    | 'circular_dependency'
    | 'unused_export'
    | 'unused_import'
    | 'missing_type'
    | 'any_type'
    | 'orphaned_file'
    | 'god_object'
    | 'high_coupling';
  severity: IssueSeverity;
  nodeIds: string[];
  message: string;
  suggestion?: string;
}

// ==================== IMPACT ANALYSIS ====================

export interface ImpactAnalysis {
  targetNode: string;
  change: NodeChange;
  directImpact: AffectedNode[];
  transitiveImpact: AffectedNode[];
  breakingChanges: BreakingChange[];
  suggestedFixes: SuggestedFix[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface NodeChange {
  nodeId: string;
  changeType:
    | 'rename'
    | 'add_field'
    | 'remove_field'
    | 'change_type'
    | 'delete'
    | 'move'
    | 'add_param'
    | 'remove_param';
  before?: any;
  after?: any;
}

export interface AffectedNode {
  nodeId: string;
  nodeName: string;
  path: string;
  line?: number;
  impactType: 'update_import' | 'update_usage' | 'type_mismatch' | 'missing_field' | 'breaking';
  description: string;
}

export interface BreakingChange {
  nodeId: string;
  path: string;
  line: number;
  currentCode: string;
  reason: string;
}

export interface SuggestedFix {
  nodeId: string;
  path: string;
  line: number;
  description: string;
  oldCode: string;
  newCode: string;
  autoFixable: boolean;
}

// ==================== PROPAGATION ====================

export interface PropagationResult {
  success: boolean;
  patchesApplied: CodePatch[];
  patchesFailed: CodePatch[];
  errors: string[];
  filesModified: string[];
}

export interface CodePatch {
  id: string;
  path: string;
  line: number;
  column?: number;
  oldCode: string;
  newCode: string;
  description: string;
  autoFixable?: boolean;
  applied?: boolean;
  error?: string;
}

// ==================== PLANNING ====================

export interface PlanNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  position: { x: number; y: number };
  isNew: boolean; // true = planning mode node, not yet created
  connectedTo: string[];
}

export interface GenerationPlan {
  nodes: PlanNode[];
  generatedCode: GeneratedFile[];
  dependencies: string[];
  estimatedFiles: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'type' | 'component' | 'api' | 'hook' | 'util' | 'test';
  fromNode: string;
}

// ==================== STORAGE ====================

export interface MindMapStorage {
  version: string;
  lastSync: string;
  nodes: CodeNode[];
  edges: Edge[];
  groups: NodeGroup[];
  coherenceScore: number;
  issues: CoherenceIssue[];
  userPositions: Record<string, { x: number; y: number }>;
  planningNodes?: PlanNode[];
}

// ==================== UI STATE ====================

export interface MindMapUIState {
  zoom: number;
  panX: number;
  panY: number;
  selectedNodes: string[];
  hoveredNode: string | null;
  mode: 'view' | 'planning' | 'impact';
  showLabels: boolean;
  showEdgeLabels: boolean;
  filterByType: NodeType[];
  searchQuery: string;
}

// ==================== MESSAGES ====================

export type MindMapMessage =
  | { type: 'init'; data: DependencyGraphData }
  | { type: 'updateGraph'; data: Partial<DependencyGraphData> }
  | { type: 'selectNode'; nodeId: string }
  | { type: 'analyzeImpact'; nodeId: string; change: NodeChange }
  | { type: 'impactResult'; data: ImpactAnalysis }
  | { type: 'applyChanges'; patches: CodePatch[] }
  | { type: 'propagationResult'; data: PropagationResult }
  | { type: 'enterPlanningMode' }
  | { type: 'exitPlanningMode' }
  | { type: 'addPlanNode'; node: PlanNode }
  | { type: 'generateFromPlan'; plan: GenerationPlan }
  | { type: 'refresh' }
  | { type: 'exportImage' }
  | { type: 'showIssues' }
  | { type: 'openFile'; path: string; line?: number }
  | { type: 'error'; message: string }
  | { type: 'loading'; isLoading: boolean };
