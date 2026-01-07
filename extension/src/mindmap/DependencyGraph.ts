/**
 * DependencyGraph - Analyzes codebase and builds a dependency graph
 * This is the core engine that understands how code connects together.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  CodeNode,
  Edge,
  DependencyGraphData,
  NodeType,
  EdgeType,
  GraphMetadata,
  CoherenceIssue,
  NodeGroup,
  ImportInfo,
  ExportInfo,
  FieldInfo,
  MethodInfo,
  IssueSeverity,
} from './types';

export class DependencyGraph {
  private nodes: Map<string, CodeNode> = new Map();
  private edges: Map<string, Edge[]> = new Map();
  private groups: NodeGroup[] = [];
  private projectPath: string;
  private projectName: string;

  // File patterns to analyze
  private readonly FILE_PATTERNS = [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
  ];

  // Directories to ignore
  private readonly IGNORE_DIRS = [
    'node_modules',
    '.next',
    'dist',
    'build',
    '.git',
    'coverage',
    '__tests__',
    '__mocks__',
  ];

  constructor() {
    this.projectPath = '';
    this.projectName = '';
  }

  /**
   * Analyze the entire codebase and build the dependency graph
   */
  async analyzeProject(): Promise<DependencyGraphData> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    this.projectPath = workspaceFolder.uri.fsPath;
    this.projectName = path.basename(this.projectPath);
    this.nodes.clear();
    this.edges.clear();
    this.groups = [];

    console.log(`MindMap: Analyzing project at ${this.projectPath}`);

    // Find all relevant files
    const files = await this.findFiles();
    console.log(`MindMap: Found ${files.length} files to analyze`);

    // Analyze each file
    for (const file of files) {
      try {
        await this.analyzeFile(file);
      } catch (error) {
        console.error(`MindMap: Error analyzing ${file}:`, error);
      }
    }

    // Build edges from import relationships
    this.buildEdges();

    // Auto-group by directory
    this.autoGroupByDirectory();

    // Calculate coherence and find issues
    const issues = this.findCoherenceIssues();
    const coherenceScore = this.calculateCoherenceScore(issues);

    // Layout nodes
    this.calculateLayout();

    const metadata: GraphMetadata = {
      projectName: this.projectName,
      projectPath: this.projectPath,
      analyzedAt: new Date().toISOString(),
      totalFiles: files.length,
      totalNodes: this.nodes.size,
      totalEdges: this.countEdges(),
      coherenceScore,
      issues,
    };

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.getAllEdges(),
      groups: this.groups,
      metadata,
    };
  }

  /**
   * Find all TypeScript/JavaScript files in the project
   */
  private async findFiles(): Promise<string[]> {
    const files: string[] = [];
    const ignorePattern = `{${this.IGNORE_DIRS.join(',')}}`;

    for (const pattern of this.FILE_PATTERNS) {
      const found = await vscode.workspace.findFiles(
        pattern,
        `**/${ignorePattern}/**`
      );
      for (const uri of found) {
        files.push(uri.fsPath);
      }
    }

    return files;
  }

  /**
   * Analyze a single file and extract nodes
   */
  private async analyzeFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(this.projectPath, filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);

    // Create file node
    const fileNodeId = this.pathToId(relativePath);
    const fileNode = this.createFileNode(fileNodeId, relativePath, content);
    this.nodes.set(fileNodeId, fileNode);

    // Extract imports
    fileNode.imports = this.extractImports(content);

    // Extract exports
    fileNode.exports = this.extractExports(content);

    // Detect node type based on file content and path
    const detectedType = this.detectNodeType(filePath, content);
    fileNode.type = detectedType;

    // Extract type-specific info
    switch (detectedType) {
      case 'component':
        fileNode.props = this.extractProps(content);
        fileNode.hooks = this.extractHooks(content);
        break;
      case 'type':
      case 'interface':
        fileNode.fields = this.extractFields(content);
        break;
      case 'api':
        fileNode.methods = this.extractApiMethods(content);
        break;
      case 'hook':
        fileNode.methods = this.extractHookMethods(content);
        break;
      case 'class':
        fileNode.methods = this.extractClassMethods(content);
        fileNode.fields = this.extractClassFields(content);
        break;
    }

    // Set style based on type
    fileNode.style = this.getStyleForType(detectedType);
  }

  /**
   * Create a file node
   */
  private createFileNode(
    id: string,
    relativePath: string,
    content: string
  ): CodeNode {
    const lines = content.split('\n');
    return {
      id,
      type: 'file',
      name: path.basename(relativePath, path.extname(relativePath)),
      path: relativePath,
      position: { x: 0, y: 0 },
      linesOfCode: lines.length,
      complexity: this.calculateComplexity(content),
      imports: [],
      exports: [],
    };
  }

  /**
   * Detect what type of node this file represents
   */
  private detectNodeType(filePath: string, content: string): NodeType {
    const fileName = path.basename(filePath).toLowerCase();
    const dirName = path.dirname(filePath).toLowerCase();

    // API routes
    if (filePath.includes('/api/') && fileName === 'route.ts') {
      return 'api';
    }
    if (filePath.includes('/pages/api/')) {
      return 'api';
    }

    // Hooks
    if (fileName.startsWith('use') && fileName.endsWith('.ts')) {
      return 'hook';
    }
    if (dirName.includes('hooks')) {
      return 'hook';
    }

    // Context
    if (fileName.includes('context') || fileName.includes('provider')) {
      return 'context';
    }

    // Types
    if (dirName.includes('types') || fileName.includes('.types.')) {
      return 'type';
    }

    // Check content for React components
    if (
      content.includes('export default function') ||
      content.includes('export function') ||
      content.includes('React.FC') ||
      content.includes(': FC<') ||
      content.includes('return (') ||
      content.includes('return <')
    ) {
      // Check if it returns JSX
      if (content.includes('<') && (content.includes('/>') || content.includes('</'))) {
        return 'component';
      }
    }

    // Check for class
    if (/class\s+\w+/.test(content)) {
      return 'class';
    }

    // Check for interface/type definitions
    if (/export\s+(interface|type)\s+\w+/.test(content)) {
      return 'interface';
    }

    // Check for enum
    if (/export\s+enum\s+\w+/.test(content)) {
      return 'enum';
    }

    // Check for constants
    if (/export\s+const\s+[A-Z_]+\s*=/.test(content)) {
      return 'constant';
    }

    // Default to function if exports functions
    if (/export\s+(async\s+)?function/.test(content)) {
      return 'function';
    }

    return 'file';
  }

  /**
   * Extract imports from file content
   */
  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    // Match various import patterns
    const importPatterns = [
      // import { a, b } from 'module'
      /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
      // import Name from 'module'
      /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
      // import * as Name from 'module'
      /import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g,
      // import type { a } from 'module'
      /import\s+type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g,
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // Named imports: import { a, b } from 'module'
      const namedMatch = line.match(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
      if (namedMatch) {
        const names = namedMatch[1].split(',').map((n) => n.trim().split(' as ')[0].trim());
        const from = namedMatch[2];
        for (const name of names) {
          if (name) {
            imports.push({
              name,
              from,
              type: line.includes('import type') ? 'type' : 'named',
              line: lineNum + 1,
            });
          }
        }
        continue;
      }

      // Default import: import Name from 'module'
      const defaultMatch = line.match(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
      if (defaultMatch && !line.includes('{')) {
        imports.push({
          name: defaultMatch[1],
          from: defaultMatch[2],
          type: 'default',
          line: lineNum + 1,
        });
        continue;
      }

      // Namespace import: import * as Name from 'module'
      const namespaceMatch = line.match(/import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/);
      if (namespaceMatch) {
        imports.push({
          name: namespaceMatch[1],
          from: namespaceMatch[2],
          type: 'namespace',
          line: lineNum + 1,
        });
      }
    }

    return imports;
  }

  /**
   * Extract exports from file content
   */
  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      // export default
      if (/export\s+default/.test(line)) {
        const nameMatch = line.match(/export\s+default\s+(?:function\s+|class\s+)?(\w+)/);
        exports.push({
          name: nameMatch ? nameMatch[1] : 'default',
          type: 'default',
          line: lineNum + 1,
        });
        continue;
      }

      // export interface
      const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        exports.push({
          name: interfaceMatch[1],
          type: 'interface',
          line: lineNum + 1,
        });
        continue;
      }

      // export type
      const typeMatch = line.match(/export\s+type\s+(\w+)/);
      if (typeMatch) {
        exports.push({
          name: typeMatch[1],
          type: 'type',
          line: lineNum + 1,
        });
        continue;
      }

      // export function/const/class
      const namedMatch = line.match(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/);
      if (namedMatch) {
        exports.push({
          name: namedMatch[1],
          type: 'named',
          line: lineNum + 1,
        });
      }
    }

    return exports;
  }

  /**
   * Extract props from React component
   */
  private extractProps(content: string): { name: string; type: string; required: boolean }[] {
    const props: { name: string; type: string; required: boolean }[] = [];

    // Match Props interface/type
    const propsMatch = content.match(/(?:interface|type)\s+\w*Props\w*\s*(?:=\s*)?\{([^}]+)\}/);
    if (propsMatch) {
      const propsContent = propsMatch[1];
      const propLines = propsContent.split('\n');

      for (const line of propLines) {
        const propMatch = line.match(/(\w+)(\?)?:\s*([^;,]+)/);
        if (propMatch) {
          props.push({
            name: propMatch[1],
            type: propMatch[3].trim(),
            required: !propMatch[2],
          });
        }
      }
    }

    return props;
  }

  /**
   * Extract hooks used in component
   */
  private extractHooks(content: string): string[] {
    const hooks: string[] = [];
    const hookMatch = content.matchAll(/\b(use\w+)\s*\(/g);

    for (const match of hookMatch) {
      if (!hooks.includes(match[1])) {
        hooks.push(match[1]);
      }
    }

    return hooks;
  }

  /**
   * Extract fields from type/interface
   */
  private extractFields(content: string): FieldInfo[] {
    const fields: FieldInfo[] = [];

    // Match interface or type body
    const bodyMatch = content.match(/(?:interface|type)\s+\w+\s*(?:=\s*)?\{([^}]+)\}/);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];
      const lines = bodyContent.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const fieldMatch = line.match(/(\w+)(\?)?:\s*([^;,]+)/);
        if (fieldMatch) {
          fields.push({
            name: fieldMatch[1],
            type: fieldMatch[3].trim(),
            optional: !!fieldMatch[2],
            line: i + 1,
          });
        }
      }
    }

    return fields;
  }

  /**
   * Extract API route methods (GET, POST, etc.)
   */
  private extractApiMethods(content: string): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const methodPatterns = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    for (const method of methodPatterns) {
      const regex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}`, 'g');
      const match = content.match(regex);
      if (match) {
        const lineMatch = content.indexOf(match[0]);
        const line = content.substring(0, lineMatch).split('\n').length;
        methods.push({
          name: method,
          params: ['request: Request'],
          returnType: 'Response',
          async: content.includes(`async function ${method}`),
          line,
        });
      }
    }

    return methods;
  }

  /**
   * Extract hook methods
   */
  private extractHookMethods(content: string): MethodInfo[] {
    const methods: MethodInfo[] = [];

    // Find the hook function
    const hookMatch = content.match(/export\s+(?:default\s+)?function\s+(use\w+)/);
    if (hookMatch) {
      methods.push({
        name: hookMatch[1],
        params: [], // Could parse params
        returnType: 'unknown',
        async: content.includes(`async function ${hookMatch[1]}`),
        line: 1,
      });
    }

    return methods;
  }

  /**
   * Extract class methods
   */
  private extractClassMethods(content: string): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g;
    const lines = content.split('\n');

    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      if (match[1] !== 'function' && match[1] !== 'if' && match[1] !== 'for' && match[1] !== 'while') {
        methods.push({
          name: match[1],
          params: [],
          returnType: 'unknown',
          async: match[0].includes('async'),
          line: lineNum,
        });
      }
    }

    return methods;
  }

  /**
   * Extract class fields
   */
  private extractClassFields(content: string): FieldInfo[] {
    const fields: FieldInfo[] = [];
    const fieldRegex = /(?:private|public|protected)?\s*(\w+)\s*(?:\?)?:\s*([^;=]+)/g;

    let match;
    while ((match = fieldRegex.exec(content)) !== null) {
      fields.push({
        name: match[1],
        type: match[2].trim(),
        optional: content.charAt(match.index + match[1].length) === '?',
      });
    }

    return fields;
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateComplexity(content: string): number {
    let complexity = 1;
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\?/g,
      /\?[^:]/g,
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Get style for node type
   */
  private getStyleForType(type: NodeType): { color: string; icon?: string } {
    const styles: Record<NodeType, { color: string; icon?: string }> = {
      file: { color: '#6b7280', icon: '📄' },
      component: { color: '#3b82f6', icon: '⚛️' },
      function: { color: '#10b981', icon: 'ƒ' },
      type: { color: '#8b5cf6', icon: 'T' },
      interface: { color: '#8b5cf6', icon: 'I' },
      api: { color: '#f59e0b', icon: '🔌' },
      hook: { color: '#ec4899', icon: '🪝' },
      context: { color: '#06b6d4', icon: '🌐' },
      class: { color: '#ef4444', icon: '📦' },
      enum: { color: '#84cc16', icon: 'E' },
      constant: { color: '#f97316', icon: 'C' },
      database: { color: '#14b8a6', icon: '🗃️' },
      external: { color: '#9ca3af', icon: '📡' },
    };

    return styles[type] || styles.file;
  }

  /**
   * Build edges from import relationships
   */
  private buildEdges(): void {
    for (const [nodeId, node] of this.nodes) {
      if (!node.imports) continue;

      for (const imp of node.imports) {
        const targetId = this.resolveImport(imp.from, node.path);
        if (targetId && this.nodes.has(targetId)) {
          const edgeType: EdgeType = imp.type === 'type' ? 'uses_type' : 'imports';
          this.addEdge(nodeId, targetId, edgeType, imp.name);
        }
      }
    }
  }

  /**
   * Resolve import path to node ID
   */
  private resolveImport(importPath: string, fromPath: string): string | null {
    // Skip external modules
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
      return null;
    }

    let resolvedPath: string;

    if (importPath.startsWith('@/')) {
      // Alias import
      resolvedPath = importPath.replace('@/', 'src/');
    } else {
      // Relative import
      const fromDir = path.dirname(fromPath);
      resolvedPath = path.join(fromDir, importPath);
    }

    // Try with extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
    for (const ext of extensions) {
      const testPath = resolvedPath + ext;
      const nodeId = this.pathToId(testPath);
      if (this.nodes.has(nodeId)) {
        return nodeId;
      }
    }

    return null;
  }

  /**
   * Add an edge between two nodes
   */
  private addEdge(source: string, target: string, type: EdgeType, label?: string): void {
    const edgeId = `${source}->${target}:${type}`;
    const edge: Edge = {
      id: edgeId,
      source,
      target,
      type,
      label,
      weight: this.getEdgeWeight(type),
    };

    if (!this.edges.has(source)) {
      this.edges.set(source, []);
    }
    this.edges.get(source)!.push(edge);
  }

  /**
   * Get edge weight based on type
   */
  private getEdgeWeight(type: EdgeType): number {
    const weights: Record<EdgeType, number> = {
      imports: 5,
      exports: 3,
      calls: 7,
      extends: 9,
      implements: 8,
      uses_type: 4,
      renders: 6,
      provides_context: 7,
      consumes_context: 6,
      has_field: 3,
      references: 2,
    };
    return weights[type] || 5;
  }

  /**
   * Auto-group nodes by directory
   */
  private autoGroupByDirectory(): void {
    const dirMap = new Map<string, string[]>();

    for (const [nodeId, node] of this.nodes) {
      const dir = path.dirname(node.path);
      const topDir = dir.split(path.sep)[0] || dir;

      if (!dirMap.has(topDir)) {
        dirMap.set(topDir, []);
      }
      dirMap.get(topDir)!.push(nodeId);
    }

    // Create groups for directories with multiple files
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    let colorIndex = 0;

    for (const [dir, nodeIds] of dirMap) {
      if (nodeIds.length >= 2) {
        this.groups.push({
          id: `group-${dir}`,
          name: dir,
          nodeIds,
          color: colors[colorIndex % colors.length],
        });
        colorIndex++;
      }
    }
  }

  /**
   * Find coherence issues in the graph
   */
  private findCoherenceIssues(): CoherenceIssue[] {
    const issues: CoherenceIssue[] = [];

    // Find circular dependencies
    const circular = this.findCircularDependencies();
    for (const cycle of circular) {
      issues.push({
        id: `circular-${cycle.join('-')}`,
        type: 'circular_dependency',
        severity: 'high',
        nodeIds: cycle,
        message: `Circular dependency: ${cycle.map((id) => this.nodes.get(id)?.name).join(' → ')}`,
        suggestion: 'Extract shared logic to a separate module',
      });
    }

    // Find unused exports
    const unusedExports = this.findUnusedExports();
    for (const { nodeId, exportName } of unusedExports) {
      issues.push({
        id: `unused-export-${nodeId}-${exportName}`,
        type: 'unused_export',
        severity: 'low',
        nodeIds: [nodeId],
        message: `Unused export: ${exportName} in ${this.nodes.get(nodeId)?.name}`,
        suggestion: 'Consider removing if not needed',
      });
    }

    // Find orphaned files (no imports or exports)
    for (const [nodeId, node] of this.nodes) {
      const hasIncoming = this.hasIncomingEdges(nodeId);
      const hasOutgoing = this.edges.has(nodeId);

      if (!hasIncoming && !hasOutgoing && node.type !== 'api') {
        issues.push({
          id: `orphan-${nodeId}`,
          type: 'orphaned_file',
          severity: 'medium',
          nodeIds: [nodeId],
          message: `Orphaned file: ${node.name} has no connections`,
          suggestion: 'This file might be unused or missing imports',
        });
      }
    }

    // Find god objects (high coupling)
    for (const [nodeId, node] of this.nodes) {
      const outgoing = this.edges.get(nodeId)?.length || 0;
      const incoming = this.countIncomingEdges(nodeId);

      if (outgoing + incoming > 15) {
        issues.push({
          id: `god-object-${nodeId}`,
          type: 'god_object',
          severity: 'medium',
          nodeIds: [nodeId],
          message: `High coupling: ${node.name} has ${outgoing + incoming} connections`,
          suggestion: 'Consider splitting into smaller modules',
        });
      }
    }

    return issues;
  }

  /**
   * Find circular dependencies using DFS
   */
  private findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const edges = this.edges.get(nodeId) || [];
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          dfs(edge.target, [...path]);
        } else if (recursionStack.has(edge.target)) {
          // Found cycle
          const cycleStart = path.indexOf(edge.target);
          const cycle = path.slice(cycleStart);
          cycle.push(edge.target);
          cycles.push(cycle);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Find exports that are never imported
   */
  private findUnusedExports(): { nodeId: string; exportName: string }[] {
    const unused: { nodeId: string; exportName: string }[] = [];
    const allImports = new Set<string>();

    // Collect all import names
    for (const node of this.nodes.values()) {
      for (const imp of node.imports || []) {
        allImports.add(imp.name);
      }
    }

    // Check exports
    for (const [nodeId, node] of this.nodes) {
      for (const exp of node.exports || []) {
        if (exp.type !== 'default' && !allImports.has(exp.name)) {
          unused.push({ nodeId, exportName: exp.name });
        }
      }
    }

    return unused;
  }

  /**
   * Check if node has incoming edges
   */
  private hasIncomingEdges(nodeId: string): boolean {
    for (const edges of this.edges.values()) {
      if (edges.some((e) => e.target === nodeId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Count incoming edges for a node
   */
  private countIncomingEdges(nodeId: string): number {
    let count = 0;
    for (const edges of this.edges.values()) {
      count += edges.filter((e) => e.target === nodeId).length;
    }
    return count;
  }

  /**
   * Calculate coherence score (0-100)
   */
  private calculateCoherenceScore(issues: CoherenceIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 15;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate layout positions for nodes
   */
  private calculateLayout(): void {
    const HORIZONTAL_SPACING = 300;
    const VERTICAL_SPACING = 150;
    const NODES_PER_ROW = 5;

    // Group by type for better organization
    const byType = new Map<NodeType, CodeNode[]>();
    for (const node of this.nodes.values()) {
      if (!byType.has(node.type)) {
        byType.set(node.type, []);
      }
      byType.get(node.type)!.push(node);
    }

    let currentY = 0;
    const typeOrder: NodeType[] = [
      'type',
      'interface',
      'context',
      'hook',
      'component',
      'api',
      'function',
      'class',
      'file',
    ];

    for (const type of typeOrder) {
      const nodes = byType.get(type) || [];
      if (nodes.length === 0) continue;

      for (let i = 0; i < nodes.length; i++) {
        const x = (i % NODES_PER_ROW) * HORIZONTAL_SPACING;
        const y = currentY + Math.floor(i / NODES_PER_ROW) * VERTICAL_SPACING;
        nodes[i].position = { x, y };
      }

      currentY += Math.ceil(nodes.length / NODES_PER_ROW) * VERTICAL_SPACING + 100;
    }
  }

  /**
   * Convert path to node ID
   */
  private pathToId(relativePath: string): string {
    return relativePath.replace(/[\\\/]/g, '-').replace(/\./g, '_');
  }

  /**
   * Count total edges
   */
  private countEdges(): number {
    let count = 0;
    for (const edges of this.edges.values()) {
      count += edges.length;
    }
    return count;
  }

  /**
   * Get all edges as flat array
   */
  private getAllEdges(): Edge[] {
    const allEdges: Edge[] = [];
    for (const edges of this.edges.values()) {
      allEdges.push(...edges);
    }
    return allEdges;
  }

  // ==================== PUBLIC API ====================

  /**
   * Get node by ID
   */
  getNode(nodeId: string): CodeNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes that depend on a given node
   */
  getDependents(nodeId: string): CodeNode[] {
    const dependents: CodeNode[] = [];
    for (const edges of this.edges.values()) {
      for (const edge of edges) {
        if (edge.target === nodeId) {
          const node = this.nodes.get(edge.source);
          if (node) dependents.push(node);
        }
      }
    }
    return dependents;
  }

  /**
   * Get all nodes that a given node depends on
   */
  getDependencies(nodeId: string): CodeNode[] {
    const edges = this.edges.get(nodeId) || [];
    return edges
      .map((e) => this.nodes.get(e.target))
      .filter((n): n is CodeNode => n !== undefined);
  }

  /**
   * Get edges for a specific node
   */
  getEdges(nodeId: string): Edge[] {
    return this.edges.get(nodeId) || [];
  }
}
