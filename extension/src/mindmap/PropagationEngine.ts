/**
 * PropagationEngine - Handles change propagation across the codebase
 * When something changes, this engine calculates what else needs to change
 * and can automatically apply those changes.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DependencyGraph } from './DependencyGraph';
import {
  CodeNode,
  NodeChange,
  ImpactAnalysis,
  AffectedNode,
  BreakingChange,
  SuggestedFix,
  PropagationResult,
  CodePatch,
} from './types';

export class PropagationEngine {
  private graph: DependencyGraph;
  private projectPath: string;
  private appliedPatches: CodePatch[] = [];

  constructor(graph: DependencyGraph) {
    this.graph = graph;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    this.projectPath = workspaceFolder?.uri.fsPath || '';
  }

  /**
   * Analyze the impact of a proposed change
   */
  async analyzeImpact(change: NodeChange): Promise<ImpactAnalysis> {
    const targetNode = this.graph.getNode(change.nodeId);
    if (!targetNode) {
      throw new Error(`Node not found: ${change.nodeId}`);
    }

    const directImpact: AffectedNode[] = [];
    const transitiveImpact: AffectedNode[] = [];
    const breakingChanges: BreakingChange[] = [];
    const suggestedFixes: SuggestedFix[] = [];

    // Get all nodes that depend on the target
    const dependents = this.graph.getDependents(change.nodeId);

    // Analyze each dependent
    for (const dependent of dependents) {
      const impact = await this.analyzeNodeImpact(dependent, targetNode, change);

      if (impact.breaking) {
        breakingChanges.push(...impact.breaking);
      }

      if (impact.affected) {
        directImpact.push(impact.affected);
      }

      if (impact.fixes) {
        suggestedFixes.push(...impact.fixes);
      }
    }

    // Find transitive impact (nodes that depend on the dependents)
    const visited = new Set<string>([change.nodeId, ...dependents.map(d => d.id)]);
    for (const dependent of dependents) {
      const secondLevel = this.graph.getDependents(dependent.id);
      for (const node of secondLevel) {
        if (!visited.has(node.id)) {
          visited.add(node.id);
          transitiveImpact.push({
            nodeId: node.id,
            nodeName: node.name,
            path: node.path,
            impactType: 'update_usage',
            description: `Transitively affected through ${dependent.name}`,
          });
        }
      }
    }

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(
      directImpact.length,
      breakingChanges.length,
      change.changeType
    );

    return {
      targetNode: change.nodeId,
      change,
      directImpact,
      transitiveImpact,
      breakingChanges,
      suggestedFixes,
      riskLevel,
    };
  }

  /**
   * Analyze impact on a specific node
   */
  private async analyzeNodeImpact(
    node: CodeNode,
    targetNode: CodeNode,
    change: NodeChange
  ): Promise<{
    affected?: AffectedNode;
    breaking?: BreakingChange[];
    fixes?: SuggestedFix[];
  }> {
    const breaking: BreakingChange[] = [];
    const fixes: SuggestedFix[] = [];

    const filePath = path.join(this.projectPath, node.path);
    if (!fs.existsSync(filePath)) {
      return {};
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    switch (change.changeType) {
      case 'rename':
        return this.analyzeRenameImpact(node, targetNode, change, content, lines);

      case 'add_field':
        return this.analyzeAddFieldImpact(node, targetNode, change, content, lines);

      case 'remove_field':
        return this.analyzeRemoveFieldImpact(node, targetNode, change, content, lines);

      case 'change_type':
        return this.analyzeTypeChangeImpact(node, targetNode, change, content, lines);

      case 'delete':
        return this.analyzeDeleteImpact(node, targetNode, change, content, lines);

      default:
        return {
          affected: {
            nodeId: node.id,
            nodeName: node.name,
            path: node.path,
            impactType: 'update_usage',
            description: `May be affected by ${change.changeType} on ${targetNode.name}`,
          },
        };
    }
  }

  /**
   * Analyze rename impact
   */
  private analyzeRenameImpact(
    node: CodeNode,
    targetNode: CodeNode,
    change: NodeChange,
    content: string,
    lines: string[]
  ): { affected?: AffectedNode; breaking?: BreakingChange[]; fixes?: SuggestedFix[] } {
    const oldName = change.before as string;
    const newName = change.after as string;
    const fixes: SuggestedFix[] = [];

    // Find all occurrences of the old name
    const regex = new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        const newLine = line.replace(regex, newName);
        fixes.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          description: `Rename ${oldName} to ${newName}`,
          oldCode: line,
          newCode: newLine,
          autoFixable: true,
        });
      }
    }

    if (fixes.length === 0) {
      return {};
    }

    return {
      affected: {
        nodeId: node.id,
        nodeName: node.name,
        path: node.path,
        impactType: 'update_import',
        description: `${fixes.length} reference(s) to ${oldName} need updating`,
      },
      fixes,
    };
  }

  /**
   * Analyze add field impact
   */
  private analyzeAddFieldImpact(
    node: CodeNode,
    targetNode: CodeNode,
    change: NodeChange,
    content: string,
    lines: string[]
  ): { affected?: AffectedNode; breaking?: BreakingChange[]; fixes?: SuggestedFix[] } {
    const fieldName = change.after?.name as string;
    const fieldType = change.after?.type as string;
    const fixes: SuggestedFix[] = [];

    // Adding a field is usually not breaking unless it's required
    // Look for object creation that might need the new field
    const typeName = targetNode.name;
    const creationRegex = new RegExp(`:\\s*${typeName}\\s*=\\s*\\{`, 'g');

    for (let i = 0; i < lines.length; i++) {
      if (creationRegex.test(lines[i])) {
        // This might need the new field added
        fixes.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          description: `Consider adding ${fieldName}: ${fieldType} to ${typeName} object`,
          oldCode: lines[i],
          newCode: lines[i], // Would need more context for actual fix
          autoFixable: false,
        });
      }
    }

    if (fixes.length === 0) {
      return {};
    }

    return {
      affected: {
        nodeId: node.id,
        nodeName: node.name,
        path: node.path,
        impactType: 'missing_field',
        description: `May need to add ${fieldName} to ${typeName} usages`,
      },
      fixes,
    };
  }

  /**
   * Analyze remove field impact
   */
  private analyzeRemoveFieldImpact(
    node: CodeNode,
    targetNode: CodeNode,
    change: NodeChange,
    content: string,
    lines: string[]
  ): { affected?: AffectedNode; breaking?: BreakingChange[]; fixes?: SuggestedFix[] } {
    const fieldName = change.before?.name as string;
    const breaking: BreakingChange[] = [];
    const fixes: SuggestedFix[] = [];

    // Find usages of the removed field
    const fieldRegex = new RegExp(`\\.${fieldName}\\b`, 'g');
    const destructureRegex = new RegExp(`\\{[^}]*\\b${fieldName}\\b[^}]*\\}`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (fieldRegex.test(line)) {
        breaking.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          currentCode: line,
          reason: `Uses removed field .${fieldName}`,
        });

        fixes.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          description: `Remove usage of .${fieldName}`,
          oldCode: line,
          newCode: line.replace(fieldRegex, ''), // Simplified
          autoFixable: false,
        });
      }

      if (destructureRegex.test(line)) {
        breaking.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          currentCode: line,
          reason: `Destructures removed field ${fieldName}`,
        });
      }
    }

    if (breaking.length === 0) {
      return {};
    }

    return {
      affected: {
        nodeId: node.id,
        nodeName: node.name,
        path: node.path,
        impactType: 'breaking',
        description: `${breaking.length} usage(s) of removed field ${fieldName}`,
      },
      breaking,
      fixes,
    };
  }

  /**
   * Analyze type change impact
   */
  private analyzeTypeChangeImpact(
    node: CodeNode,
    targetNode: CodeNode,
    change: NodeChange,
    content: string,
    lines: string[]
  ): { affected?: AffectedNode; breaking?: BreakingChange[]; fixes?: SuggestedFix[] } {
    const fieldName = change.before?.name as string;
    const oldType = change.before?.type as string;
    const newType = change.after?.type as string;
    const breaking: BreakingChange[] = [];
    const fixes: SuggestedFix[] = [];

    // Look for usages that assume the old type
    const usageRegex = new RegExp(`\\.${fieldName}\\b`, 'g');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (usageRegex.test(line)) {
        // Check if there's a type assertion or comparison that won't work
        if (this.mightHaveTypeConflict(line, fieldName, oldType, newType)) {
          breaking.push({
            nodeId: node.id,
            path: node.path,
            line: i + 1,
            currentCode: line,
            reason: `Type change: ${fieldName} changed from ${oldType} to ${newType}`,
          });

          fixes.push({
            nodeId: node.id,
            path: node.path,
            line: i + 1,
            description: `Update usage for new type ${newType}`,
            oldCode: line,
            newCode: line, // Would need context for actual fix
            autoFixable: false,
          });
        }
      }
    }

    if (breaking.length === 0) {
      return {
        affected: {
          nodeId: node.id,
          nodeName: node.name,
          path: node.path,
          impactType: 'type_mismatch',
          description: `Uses ${fieldName} which changed from ${oldType} to ${newType}`,
        },
      };
    }

    return {
      affected: {
        nodeId: node.id,
        nodeName: node.name,
        path: node.path,
        impactType: 'type_mismatch',
        description: `${breaking.length} potential type conflict(s)`,
      },
      breaking,
      fixes,
    };
  }

  /**
   * Analyze delete impact
   */
  private analyzeDeleteImpact(
    node: CodeNode,
    targetNode: CodeNode,
    change: NodeChange,
    content: string,
    lines: string[]
  ): { affected?: AffectedNode; breaking?: BreakingChange[]; fixes?: SuggestedFix[] } {
    const breaking: BreakingChange[] = [];
    const fixes: SuggestedFix[] = [];

    // Check if there's an import of the deleted item
    const importRegex = new RegExp(
      `import\\s+(?:.*\\{[^}]*\\b${targetNode.name}\\b[^}]*\\}|${targetNode.name})\\s+from`,
      'g'
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (importRegex.test(line)) {
        breaking.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          currentCode: line,
          reason: `Imports deleted module ${targetNode.name}`,
        });

        fixes.push({
          nodeId: node.id,
          path: node.path,
          line: i + 1,
          description: `Remove import of deleted ${targetNode.name}`,
          oldCode: line,
          newCode: '', // Remove the line
          autoFixable: true,
        });
      }
    }

    if (breaking.length === 0) {
      return {};
    }

    return {
      affected: {
        nodeId: node.id,
        nodeName: node.name,
        path: node.path,
        impactType: 'breaking',
        description: `Imports deleted ${targetNode.name}`,
      },
      breaking,
      fixes,
    };
  }

  /**
   * Check if a line might have type conflicts
   */
  private mightHaveTypeConflict(
    line: string,
    fieldName: string,
    oldType: string,
    newType: string
  ): boolean {
    // If changing from string to number or vice versa
    if (
      (oldType.includes('string') && newType.includes('number')) ||
      (oldType.includes('number') && newType.includes('string'))
    ) {
      // Check for string operations
      if (line.includes('.length') || line.includes('.charAt') || line.includes('.split')) {
        return true;
      }
      // Check for math operations
      if (/[+\-*/]/.test(line)) {
        return true;
      }
    }

    // If changing to/from union types
    if (newType.includes('|') || oldType.includes('|')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate risk level based on impact
   */
  private calculateRiskLevel(
    directImpactCount: number,
    breakingCount: number,
    changeType: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (breakingCount > 5 || (changeType === 'delete' && directImpactCount > 3)) {
      return 'critical';
    }
    if (breakingCount > 0 || directImpactCount > 10) {
      return 'high';
    }
    if (directImpactCount > 5) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Apply a set of code patches
   */
  async applyPatches(patches: CodePatch[]): Promise<PropagationResult> {
    const patchesApplied: CodePatch[] = [];
    const patchesFailed: CodePatch[] = [];
    const errors: string[] = [];
    const filesModified = new Set<string>();

    // Group patches by file
    const patchesByFile = new Map<string, CodePatch[]>();
    for (const patch of patches) {
      if (!patchesByFile.has(patch.path)) {
        patchesByFile.set(patch.path, []);
      }
      patchesByFile.get(patch.path)!.push(patch);
    }

    // Apply patches file by file
    for (const [filePath, filePatches] of patchesByFile) {
      try {
        const fullPath = path.join(this.projectPath, filePath);

        if (!fs.existsSync(fullPath)) {
          errors.push(`File not found: ${filePath}`);
          for (const patch of filePatches) {
            patch.error = 'File not found';
            patchesFailed.push(patch);
          }
          continue;
        }

        let content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        // Sort patches by line number (descending) to apply from bottom up
        // This prevents line number shifts from affecting other patches
        filePatches.sort((a, b) => b.line - a.line);

        for (const patch of filePatches) {
          try {
            const lineIndex = patch.line - 1;

            if (lineIndex < 0 || lineIndex >= lines.length) {
              patch.error = `Line ${patch.line} out of range`;
              patchesFailed.push(patch);
              continue;
            }

            // Verify the old code matches
            if (lines[lineIndex].trim() !== patch.oldCode.trim()) {
              // Try to find the line nearby
              const found = this.findMatchingLine(lines, patch.oldCode, patch.line);
              if (found === -1) {
                patch.error = 'Code has changed, cannot apply patch';
                patchesFailed.push(patch);
                continue;
              }
              patch.line = found + 1;
            }

            // Apply the patch
            if (patch.newCode === '') {
              // Delete the line
              lines.splice(patch.line - 1, 1);
            } else {
              lines[patch.line - 1] = patch.newCode;
            }

            patch.applied = true;
            patchesApplied.push(patch);
          } catch (error: any) {
            patch.error = error.message;
            patchesFailed.push(patch);
          }
        }

        // Write the modified content back
        content = lines.join('\n');
        fs.writeFileSync(fullPath, content, 'utf-8');
        filesModified.add(filePath);

      } catch (error: any) {
        errors.push(`Error processing ${filePath}: ${error.message}`);
        for (const patch of filePatches) {
          if (!patch.applied) {
            patch.error = error.message;
            patchesFailed.push(patch);
          }
        }
      }
    }

    this.appliedPatches.push(...patchesApplied);

    return {
      success: patchesFailed.length === 0,
      patchesApplied,
      patchesFailed,
      errors,
      filesModified: Array.from(filesModified),
    };
  }

  /**
   * Find a matching line near the expected position
   */
  private findMatchingLine(lines: string[], targetCode: string, expectedLine: number): number {
    const target = targetCode.trim();
    const searchRadius = 5;

    for (let offset = 0; offset <= searchRadius; offset++) {
      // Check above
      if (expectedLine - 1 - offset >= 0) {
        if (lines[expectedLine - 1 - offset].trim() === target) {
          return expectedLine - 1 - offset;
        }
      }
      // Check below
      if (expectedLine - 1 + offset < lines.length) {
        if (lines[expectedLine - 1 + offset].trim() === target) {
          return expectedLine - 1 + offset;
        }
      }
    }

    return -1;
  }

  /**
   * Rollback applied patches
   */
  async rollback(patchIds: string[]): Promise<PropagationResult> {
    const toRollback = patchIds.length > 0
      ? this.appliedPatches.filter((p) => patchIds.includes(p.id))
      : [...this.appliedPatches];

    // Create inverse patches
    const inversePatches: CodePatch[] = toRollback.map((patch) => ({
      ...patch,
      id: `rollback-${patch.id}`,
      oldCode: patch.newCode,
      newCode: patch.oldCode,
      description: `Rollback: ${patch.description}`,
      applied: false,
    }));

    const result = await this.applyPatches(inversePatches);

    // Remove rolled back patches from history
    if (result.success) {
      const rolledBackIds = new Set(toRollback.map((p) => p.id));
      this.appliedPatches = this.appliedPatches.filter((p) => !rolledBackIds.has(p.id));
    }

    return result;
  }

  /**
   * Generate patches for a rename operation
   */
  async generateRenamePatches(
    nodeId: string,
    oldName: string,
    newName: string
  ): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];
    const dependents = this.graph.getDependents(nodeId);

    for (const node of dependents) {
      const filePath = path.join(this.projectPath, node.path);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const regex = new RegExp(`\\b${this.escapeRegex(oldName)}\\b`, 'g');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (regex.test(line)) {
          patches.push({
            id: `rename-${node.id}-${i}`,
            path: node.path,
            line: i + 1,
            oldCode: line,
            newCode: line.replace(regex, newName),
            description: `Rename ${oldName} to ${newName}`,
            autoFixable: true,
          });
        }
      }
    }

    return patches;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get applied patches history
   */
  getAppliedPatches(): CodePatch[] {
    return [...this.appliedPatches];
  }

  /**
   * Clear patches history
   */
  clearHistory(): void {
    this.appliedPatches = [];
  }
}
