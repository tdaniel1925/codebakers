/**
 * MindMapPanelProvider - VS Code Webview panel for the Mind Map
 * Displays the dependency graph with an interactive canvas interface.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DependencyGraph } from './DependencyGraph';
import { PropagationEngine } from './PropagationEngine';
import {
  DependencyGraphData,
  CodeNode,
  Edge,
  NodeChange,
  ImpactAnalysis,
  MindMapStorage,
  CoherenceIssue,
} from './types';

export class MindMapPanelProvider {
  public static currentPanel: MindMapPanelProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private graph: DependencyGraph;
  private propagation: PropagationEngine;
  private graphData: DependencyGraphData | null = null;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this.graph = new DependencyGraph();
    this.propagation = new PropagationEngine(this.graph);

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  /**
   * Create or show the mind map panel
   */
  public static createOrShow(extensionUri: vscode.Uri): MindMapPanelProvider {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (MindMapPanelProvider.currentPanel) {
      MindMapPanelProvider.currentPanel._panel.reveal(column);
      return MindMapPanelProvider.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'codebakers.mindmap',
      'CodeBakers Mind Map',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    MindMapPanelProvider.currentPanel = new MindMapPanelProvider(panel, extensionUri);
    return MindMapPanelProvider.currentPanel;
  }

  /**
   * Analyze the project and display the mind map
   */
  public async analyze(): Promise<void> {
    this._postMessage({ type: 'loading', isLoading: true });

    try {
      // Check for saved positions
      const savedData = await this._loadSavedData();

      // Analyze the project
      this.graphData = await this.graph.analyzeProject();

      // Apply saved positions if available
      if (savedData?.userPositions) {
        for (const node of this.graphData.nodes) {
          if (savedData.userPositions[node.id]) {
            node.position = savedData.userPositions[node.id];
          }
        }
      }

      // Send to webview
      this._postMessage({ type: 'init', data: this.graphData });

    } catch (error: any) {
      console.error('MindMap: Analysis failed:', error);
      this._postMessage({ type: 'error', message: error.message });
    } finally {
      this._postMessage({ type: 'loading', isLoading: false });
    }
  }

  /**
   * Handle messages from the webview
   */
  private async _handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.analyze();
        break;

      case 'refresh':
        await this.analyze();
        break;

      case 'selectNode':
        // Handle node selection
        const node = this.graph.getNode(message.nodeId);
        if (node) {
          const dependents = this.graph.getDependents(message.nodeId);
          const dependencies = this.graph.getDependencies(message.nodeId);
          this._postMessage({
            type: 'nodeDetails',
            node,
            dependents,
            dependencies,
          });
        }
        break;

      case 'analyzeImpact':
        try {
          const impact = await this.propagation.analyzeImpact(message.change);
          this._postMessage({ type: 'impactResult', data: impact });
        } catch (error: any) {
          this._postMessage({ type: 'error', message: error.message });
        }
        break;

      case 'applyChanges':
        try {
          const result = await this.propagation.applyPatches(message.patches);
          this._postMessage({ type: 'propagationResult', data: result });
          // Refresh the graph
          await this.analyze();
        } catch (error: any) {
          this._postMessage({ type: 'error', message: error.message });
        }
        break;

      case 'openFile':
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open');
          break;
        }
        const uri = vscode.Uri.file(
          path.join(workspaceFolder.uri.fsPath, message.path)
        );
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(doc);
          if (message.line) {
            const position = new vscode.Position(message.line - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Could not open file: ${error.message}`);
        }
        break;

      case 'savePositions':
        await this._savePositions(message.positions);
        break;

      case 'exportImage':
        vscode.window.showInformationMessage('Export feature coming soon!');
        break;
    }
  }

  /**
   * Load saved mind map data
   */
  private async _loadSavedData(): Promise<MindMapStorage | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;

    const savePath = path.join(
      workspaceFolder.uri.fsPath,
      '.codebakers',
      'mindmap.json'
    );

    if (!fs.existsSync(savePath)) return null;

    try {
      const content = fs.readFileSync(savePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save node positions
   */
  private async _savePositions(
    positions: Record<string, { x: number; y: number }>
  ): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const codebakersDir = path.join(workspaceFolder.uri.fsPath, '.codebakers');
    const savePath = path.join(codebakersDir, 'mindmap.json');

    // Ensure directory exists
    if (!fs.existsSync(codebakersDir)) {
      fs.mkdirSync(codebakersDir, { recursive: true });
    }

    const data: Partial<MindMapStorage> = {
      version: '1.0',
      lastSync: new Date().toISOString(),
      userPositions: positions,
    };

    // Merge with existing data
    const existing = await this._loadSavedData();
    if (existing) {
      data.userPositions = { ...existing.userPositions, ...positions };
    }

    fs.writeFileSync(savePath, JSON.stringify(data, null, 2));
  }

  /**
   * Post message to webview
   */
  private _postMessage(message: any): void {
    this._panel.webview.postMessage(message);
  }

  /**
   * Update webview content
   */
  private _update(): void {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  /**
   * Get HTML content for the webview
   */
  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers Mind Map</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; overflow: hidden; height: 100vh; }

    /* Header */
    .header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1e293b; border-bottom: 1px solid #334155; }
    .header h1 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .header-actions { display: flex; gap: 8px; }
    .btn { padding: 6px 12px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-secondary { background: #334155; color: #e2e8f0; }
    .btn-secondary:hover { background: #475569; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .btn-success { background: #22c55e; color: white; }
    .btn-success:hover { background: #16a34a; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Stats Bar */
    .stats-bar { display: flex; gap: 24px; padding: 8px 16px; background: #1e293b; border-bottom: 1px solid #334155; font-size: 13px; }
    .stat { display: flex; align-items: center; gap: 6px; }
    .stat-value { font-weight: 600; color: #3b82f6; }
    .stat-label { color: #94a3b8; }
    .coherence-score { display: flex; align-items: center; gap: 8px; }
    .coherence-bar { width: 100px; height: 6px; background: #334155; border-radius: 3px; overflow: hidden; }
    .coherence-fill { height: 100%; transition: width 0.3s; }

    /* Canvas Container */
    .canvas-container { position: relative; height: calc(100vh - 100px); overflow: hidden; }
    #mindmap-canvas { position: absolute; top: 0; left: 0; cursor: grab; }
    #mindmap-canvas.dragging { cursor: grabbing; }

    /* Context Menu */
    .context-menu { position: fixed; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 4px 0; min-width: 180px; z-index: 1000; display: none; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .context-menu.show { display: block; }
    .context-menu-item { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 13px; }
    .context-menu-item:hover { background: #334155; }
    .context-menu-item.danger { color: #ef4444; }
    .context-menu-divider { height: 1px; background: #334155; margin: 4px 0; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 2000; }
    .modal-overlay.show { display: flex; }
    .modal { background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 480px; max-height: 80vh; overflow: hidden; }
    .modal-header { padding: 16px 20px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .modal-header h2 { font-size: 16px; font-weight: 600; }
    .modal-body { padding: 20px; max-height: 60vh; overflow-y: auto; }
    .modal-footer { padding: 16px 20px; border-top: 1px solid #334155; display: flex; justify-content: flex-end; gap: 12px; }

    /* Form Elements */
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #94a3b8; }
    .form-input { width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; font-size: 14px; }
    .form-input:focus { outline: none; border-color: #3b82f6; }

    /* Impact Panel */
    .impact-panel { position: absolute; top: 0; right: 0; width: 400px; height: 100%; background: #1e293b; border-left: 1px solid #334155; transform: translateX(100%); transition: transform 0.3s; z-index: 500; display: flex; flex-direction: column; }
    .impact-panel.open { transform: translateX(0); }
    .impact-header { padding: 16px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .impact-header h3 { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .impact-content { flex: 1; overflow-y: auto; padding: 16px; }
    .impact-footer { padding: 16px; border-top: 1px solid #334155; display: flex; gap: 12px; }
    .impact-section { margin-bottom: 20px; }
    .impact-section h4 { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    .impact-item { padding: 10px 12px; background: #0f172a; border-radius: 6px; margin-bottom: 8px; font-size: 13px; border-left: 3px solid #3b82f6; cursor: pointer; }
    .impact-item:hover { background: #1e293b; }
    .impact-item.breaking { border-left-color: #ef4444; background: rgba(239,68,68,0.1); }
    .impact-item.warning { border-left-color: #f59e0b; }
    .impact-item .path { color: #94a3b8; font-size: 11px; margin-top: 4px; }
    .risk-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .risk-badge.low { background: #22c55e33; color: #22c55e; }
    .risk-badge.medium { background: #f59e0b33; color: #f59e0b; }
    .risk-badge.high { background: #f9731633; color: #f97316; }
    .risk-badge.critical { background: #ef444433; color: #ef4444; }

    /* Patch Preview */
    .patch-preview { background: #0f172a; border-radius: 6px; padding: 12px; margin-top: 8px; font-family: 'Fira Code', monospace; font-size: 12px; }
    .patch-line { padding: 2px 0; }
    .patch-line.remove { color: #ef4444; background: rgba(239,68,68,0.1); }
    .patch-line.add { color: #22c55e; background: rgba(34,197,94,0.1); }

    /* Details Panel */
    .details-panel { position: absolute; top: 0; right: 0; width: 320px; height: 100%; background: #1e293b; border-left: 1px solid #334155; transform: translateX(100%); transition: transform 0.3s; overflow-y: auto; z-index: 400; }
    .details-panel.open { transform: translateX(0); }
    .details-header { padding: 16px; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between; }
    .details-title { font-size: 14px; font-weight: 600; }
    .close-btn { width: 28px; height: 28px; border: none; background: transparent; color: #94a3b8; font-size: 18px; cursor: pointer; border-radius: 4px; }
    .close-btn:hover { background: #334155; }
    .details-content { padding: 16px; }
    .details-actions { padding: 12px 16px; border-bottom: 1px solid #334155; display: flex; gap: 8px; }
    .detail-section { margin-bottom: 16px; }
    .detail-section h4 { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
    .detail-item { padding: 8px; background: #0f172a; border-radius: 6px; margin-bottom: 6px; font-size: 13px; cursor: pointer; }
    .detail-item:hover { background: #1e293b; }
    .node-type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }

    /* Issues Panel */
    .issues-panel { position: absolute; bottom: 0; left: 0; right: 400px; max-height: 200px; background: #1e293b; border-top: 1px solid #334155; transform: translateY(100%); transition: transform 0.3s; overflow-y: auto; }
    .issues-panel.open { transform: translateY(0); }
    .issue-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #334155; cursor: pointer; }
    .issue-item:hover { background: #334155; }
    .issue-severity { width: 8px; height: 8px; border-radius: 50%; }
    .issue-severity.critical { background: #ef4444; }
    .issue-severity.high { background: #f97316; }
    .issue-severity.medium { background: #eab308; }
    .issue-severity.low { background: #22c55e; }

    /* Minimap & Controls */
    .minimap { position: absolute; bottom: 16px; right: 16px; width: 200px; height: 150px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .minimap-canvas { width: 100%; height: 100%; }
    .controls { position: absolute; bottom: 16px; left: 16px; display: flex; flex-direction: column; gap: 8px; }
    .zoom-controls { display: flex; flex-direction: column; background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; }
    .zoom-btn { width: 36px; height: 36px; border: none; background: transparent; color: #e2e8f0; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .zoom-btn:hover { background: #334155; }
    .zoom-btn:first-child { border-bottom: 1px solid #334155; }

    /* Legend */
    .legend { position: absolute; top: 16px; left: 16px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .legend-item:last-child { margin-bottom: 0; }
    .legend-color { width: 12px; height: 12px; border-radius: 3px; }

    /* Loading & Tooltips */
    .loading-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 3000; }
    .loading-overlay.hidden { display: none; }
    .spinner { width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { margin-top: 16px; color: #94a3b8; }
    .tooltip { position: absolute; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; font-size: 12px; pointer-events: none; z-index: 100; max-width: 250px; }
    .tooltip-title { font-weight: 600; margin-bottom: 4px; }
    .tooltip-type { color: #94a3b8; font-size: 11px; }

    /* Mode Indicator */
    .mode-indicator { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); padding: 8px 16px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; font-size: 13px; display: none; }
    .mode-indicator.active { display: block; }

    /* Search */
    .search-container { position: relative; }
    .search-input { padding: 6px 12px 6px 32px; border: 1px solid #334155; border-radius: 6px; background: #0f172a; color: #e2e8f0; font-size: 13px; width: 200px; }
    .search-input:focus { outline: none; border-color: #3b82f6; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b; }

    /* Affected nodes highlighting */
    .affected-overlay { position: absolute; pointer-events: none; }
  </style>
</head>
<body>
  <header class="header">
    <h1>🗺️ CodeBakers Mind Map</h1>
    <div class="header-actions">
      <div class="search-container">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" placeholder="Search nodes..." id="search-input">
      </div>
      <button class="btn btn-secondary" id="btn-issues">⚠️ Issues</button>
      <button class="btn btn-secondary" id="btn-refresh">🔄 Refresh</button>
    </div>
  </header>

  <div class="stats-bar" id="stats-bar">
    <div class="stat"><span class="stat-value" id="stat-files">-</span><span class="stat-label">Files</span></div>
    <div class="stat"><span class="stat-value" id="stat-nodes">-</span><span class="stat-label">Nodes</span></div>
    <div class="stat"><span class="stat-value" id="stat-edges">-</span><span class="stat-label">Connections</span></div>
    <div class="coherence-score">
      <span class="stat-label">Coherence:</span>
      <div class="coherence-bar"><div class="coherence-fill" id="coherence-fill" style="width: 0%; background: #22c55e;"></div></div>
      <span class="stat-value" id="stat-coherence">-</span>
    </div>
  </div>

  <div class="canvas-container" id="canvas-container">
    <canvas id="mindmap-canvas"></canvas>
    <div class="legend" id="legend">
      <div class="legend-item"><div class="legend-color" style="background: #3b82f6;"></div><span>Component</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #8b5cf6;"></div><span>Type/Interface</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #f59e0b;"></div><span>API Route</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #ec4899;"></div><span>Hook</span></div>
      <div class="legend-item"><div class="legend-color" style="background: #10b981;"></div><span>Function</span></div>
    </div>
    <div class="controls">
      <div class="zoom-controls">
        <button class="zoom-btn" id="zoom-in">+</button>
        <button class="zoom-btn" id="zoom-out">−</button>
      </div>
    </div>
    <div class="minimap"><canvas class="minimap-canvas" id="minimap-canvas"></canvas></div>
    <div class="mode-indicator" id="mode-indicator">⚡ Impact Analysis Mode</div>
  </div>

  <!-- Context Menu -->
  <div class="context-menu" id="context-menu">
    <div class="context-menu-item" data-action="open">📄 Open File</div>
    <div class="context-menu-item" data-action="rename">✏️ Rename...</div>
    <div class="context-menu-item" data-action="impact">⚡ Analyze Impact</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" data-action="dependents">👆 Find Dependents</div>
    <div class="context-menu-item" data-action="dependencies">👇 Find Dependencies</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item danger" data-action="delete">🗑️ Delete (Preview Impact)</div>
  </div>

  <!-- Rename Modal -->
  <div class="modal-overlay" id="rename-modal">
    <div class="modal">
      <div class="modal-header">
        <h2>✏️ Rename</h2>
        <button class="close-btn" id="close-rename">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Current Name</label>
          <input type="text" class="form-input" id="rename-old" readonly>
        </div>
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input type="text" class="form-input" id="rename-new" placeholder="Enter new name...">
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">
          This will analyze the impact before making any changes.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cancel-rename">Cancel</button>
        <button class="btn btn-primary" id="confirm-rename">⚡ Analyze Impact</button>
      </div>
    </div>
  </div>

  <!-- Details Panel -->
  <div class="details-panel" id="details-panel">
    <div class="details-header">
      <span class="details-title" id="details-title">Node Details</span>
      <button class="close-btn" id="close-details">×</button>
    </div>
    <div class="details-actions" id="details-actions">
      <button class="btn btn-secondary" id="btn-rename-node">✏️ Rename</button>
      <button class="btn btn-secondary" id="btn-impact-node">⚡ Impact</button>
      <button class="btn btn-secondary" id="btn-open-node">📄 Open</button>
    </div>
    <div class="details-content" id="details-content"></div>
  </div>

  <!-- Impact Panel -->
  <div class="impact-panel" id="impact-panel">
    <div class="impact-header">
      <h3>⚡ Impact Analysis</h3>
      <button class="close-btn" id="close-impact">×</button>
    </div>
    <div class="impact-content" id="impact-content"></div>
    <div class="impact-footer">
      <button class="btn btn-secondary" id="cancel-impact">Cancel</button>
      <button class="btn btn-success" id="apply-changes" disabled>✓ Apply All Changes</button>
    </div>
  </div>

  <!-- Issues Panel -->
  <div class="issues-panel" id="issues-panel">
    <div style="padding: 12px 16px; border-bottom: 1px solid #334155; font-weight: 600;">⚠️ Coherence Issues</div>
    <div id="issues-list"></div>
  </div>

  <!-- Loading Overlay -->
  <div class="loading-overlay" id="loading-overlay">
    <div class="spinner"></div>
    <div class="loading-text" id="loading-text">Analyzing codebase...</div>
  </div>

  <!-- Tooltip -->
  <div class="tooltip" id="tooltip" style="display: none;"></div>

  <script>
    const vscode = acquireVsCodeApi();

    // State
    let graphData = null;
    let selectedNode = null;
    let hoveredNode = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let isPanning = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let draggedNode = null;
    let contextMenuNode = null;
    let currentImpact = null;
    let pendingPatches = [];
    let affectedNodeIds = new Set();

    // Canvas setup
    const container = document.getElementById('canvas-container');
    const canvas = document.getElementById('mindmap-canvas');
    const ctx = canvas.getContext('2d');
    const minimapCanvas = document.getElementById('minimap-canvas');
    const minimapCtx = minimapCanvas.getContext('2d');

    // Node type colors
    const typeColors = {
      file: '#6b7280', component: '#3b82f6', function: '#10b981', type: '#8b5cf6',
      interface: '#8b5cf6', api: '#f59e0b', hook: '#ec4899', context: '#06b6d4',
      class: '#ef4444', enum: '#84cc16', constant: '#f97316', database: '#14b8a6', external: '#9ca3af',
    };

    function resizeCanvas() {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      minimapCanvas.width = 200;
      minimapCanvas.height = 150;
      render();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Main render
    function render() {
      if (!graphData) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);
      for (const edge of graphData.edges) drawEdge(edge);
      for (const node of graphData.nodes) drawNode(node);
      ctx.restore();
      renderMinimap();
    }

    function drawNode(node) {
      const x = node.position.x, y = node.position.y;
      const width = 160, height = 60, radius = 8;
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isAffected = affectedNodeIds.has(node.id);

      if (isSelected || isHovered || isAffected) {
        ctx.shadowColor = isAffected ? '#f97316' : (typeColors[node.type] || '#3b82f6');
        ctx.shadowBlur = isAffected ? 20 : 15;
      }

      ctx.fillStyle = isAffected ? '#1e293b' : (isSelected ? '#1e293b' : '#0f172a');
      ctx.strokeStyle = isAffected ? '#f97316' : (typeColors[node.type] || '#3b82f6');
      ctx.lineWidth = isAffected ? 3 : (isSelected ? 3 : (isHovered ? 2 : 1));

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isAffected ? '#f97316' : (typeColors[node.type] || '#3b82f6');
      ctx.fillRect(x, y, 4, height);

      const icons = { component: '⚛️', type: 'T', interface: 'I', api: '🔌', hook: '🪝', context: '🌐', function: 'ƒ', class: '📦', file: '📄' };
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px sans-serif';
      ctx.fillText(icons[node.type] || '📄', x + 12, y + 25);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(node.name.length > 15 ? node.name.slice(0, 15) + '...' : node.name, x + 32, y + 25);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(node.type.toUpperCase(), x + 32, y + 42);

      if (node.linesOfCode) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.fillText(node.linesOfCode + ' lines', x + width - 50, y + 42);
      }
    }

    function drawEdge(edge) {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const startX = sourceNode.position.x + 160, startY = sourceNode.position.y + 30;
      const endX = targetNode.position.x, endY = targetNode.position.y + 30;
      const midX = (startX + endX) / 2;

      const isAffectedEdge = affectedNodeIds.has(edge.source) || affectedNodeIds.has(edge.target);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
      ctx.strokeStyle = isAffectedEdge ? '#f97316' : '#475569';
      ctx.lineWidth = isAffectedEdge ? 2 : 1;
      ctx.stroke();

      const angle = Math.atan2(endY - startY, endX - midX);
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 8 * Math.cos(angle - Math.PI / 6), endY - 8 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(endX - 8 * Math.cos(angle + Math.PI / 6), endY - 8 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = isAffectedEdge ? '#f97316' : '#475569';
      ctx.fill();
    }

    function renderMinimap() {
      if (!graphData || graphData.nodes.length === 0) return;
      minimapCtx.clearRect(0, 0, 200, 150);
      minimapCtx.fillStyle = '#0f172a';
      minimapCtx.fillRect(0, 0, 200, 150);

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of graphData.nodes) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + 160);
        maxY = Math.max(maxY, node.position.y + 60);
      }
      const graphWidth = maxX - minX + 100, graphHeight = maxY - minY + 100;
      const scale = Math.min(200 / graphWidth, 150 / graphHeight) * 0.9;

      for (const node of graphData.nodes) {
        minimapCtx.beginPath();
        minimapCtx.arc((node.position.x - minX + 50) * scale, (node.position.y - minY + 50) * scale, 3, 0, Math.PI * 2);
        minimapCtx.fillStyle = affectedNodeIds.has(node.id) ? '#f97316' : (typeColors[node.type] || '#3b82f6');
        minimapCtx.fill();
      }

      minimapCtx.strokeStyle = '#3b82f6';
      minimapCtx.lineWidth = 1;
      minimapCtx.strokeRect((-panX / zoom - minX + 50) * scale, (-panY / zoom - minY + 50) * scale, (canvas.width / zoom) * scale, (canvas.height / zoom) * scale);
    }

    function getNodeAtPosition(x, y) {
      if (!graphData) return null;
      const canvasX = (x - panX) / zoom, canvasY = (y - panY) / zoom;
      for (const node of graphData.nodes) {
        if (canvasX >= node.position.x && canvasX <= node.position.x + 160 && canvasY >= node.position.y && canvasY <= node.position.y + 60) return node;
      }
      return null;
    }

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      hideContextMenu();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const node = getNodeAtPosition(x, y);
      if (node) {
        draggedNode = node;
        dragStartX = x - node.position.x * zoom - panX;
        dragStartY = y - node.position.y * zoom - panY;
        isDragging = true;
      } else {
        isPanning = true;
        dragStartX = x - panX;
        dragStartY = y - panY;
      }
      canvas.classList.add('dragging');
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (isDragging && draggedNode) {
        draggedNode.position.x = (x - dragStartX - panX) / zoom;
        draggedNode.position.y = (y - dragStartY - panY) / zoom;
        render();
      } else if (isPanning) {
        panX = x - dragStartX;
        panY = y - dragStartY;
        render();
      } else {
        const node = getNodeAtPosition(x, y);
        if (node !== hoveredNode) {
          hoveredNode = node;
          render();
          const tooltip = document.getElementById('tooltip');
          if (node) {
            tooltip.innerHTML = '<div class="tooltip-title">' + node.name + '</div><div class="tooltip-type">' + node.type.toUpperCase() + ' • ' + node.path + '</div>';
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
          } else {
            tooltip.style.display = 'none';
          }
        }
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (isDragging && draggedNode) {
        vscode.postMessage({ type: 'savePositions', positions: { [draggedNode.id]: draggedNode.position } });
      }
      isDragging = false;
      isPanning = false;
      draggedNode = null;
      canvas.classList.remove('dragging');
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        selectedNode = node;
        showNodeDetails(node);
        render();
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) vscode.postMessage({ type: 'openFile', path: node.path });
    });

    // Context menu
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const node = getNodeAtPosition(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        contextMenuNode = node;
        selectedNode = node;
        showContextMenu(e.clientX, e.clientY);
        render();
      }
    });

    function showContextMenu(x, y) {
      const menu = document.getElementById('context-menu');
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.classList.add('show');
    }

    function hideContextMenu() {
      document.getElementById('context-menu').classList.remove('show');
    }

    document.getElementById('context-menu').addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item || !contextMenuNode) return;
      const action = item.dataset.action;

      switch (action) {
        case 'open':
          vscode.postMessage({ type: 'openFile', path: contextMenuNode.path });
          break;
        case 'rename':
          showRenameModal(contextMenuNode);
          break;
        case 'impact':
          analyzeImpact(contextMenuNode, 'rename', contextMenuNode.name, contextMenuNode.name);
          break;
        case 'delete':
          analyzeImpact(contextMenuNode, 'delete');
          break;
        case 'dependents':
          highlightDependents(contextMenuNode);
          break;
        case 'dependencies':
          highlightDependencies(contextMenuNode);
          break;
      }
      hideContextMenu();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.context-menu')) hideContextMenu();
    });

    // Rename modal
    function showRenameModal(node) {
      document.getElementById('rename-old').value = node.name;
      document.getElementById('rename-new').value = '';
      document.getElementById('rename-modal').classList.add('show');
      document.getElementById('rename-new').focus();
    }

    document.getElementById('close-rename').addEventListener('click', () => document.getElementById('rename-modal').classList.remove('show'));
    document.getElementById('cancel-rename').addEventListener('click', () => document.getElementById('rename-modal').classList.remove('show'));

    document.getElementById('confirm-rename').addEventListener('click', () => {
      const newName = document.getElementById('rename-new').value.trim();
      if (!newName || !selectedNode) return;
      document.getElementById('rename-modal').classList.remove('show');
      analyzeImpact(selectedNode, 'rename', selectedNode.name, newName);
    });

    document.getElementById('rename-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('confirm-rename').click();
    });

    // Impact analysis
    function analyzeImpact(node, changeType, before, after) {
      setLoading(true, 'Analyzing impact...');
      document.getElementById('mode-indicator').classList.add('active');

      const change = { nodeId: node.id, changeType, before, after };
      vscode.postMessage({ type: 'analyzeImpact', change });
    }

    function showImpactPanel(impact) {
      currentImpact = impact;
      const panel = document.getElementById('impact-panel');
      const content = document.getElementById('impact-content');
      const targetNode = graphData.nodes.find(n => n.id === impact.targetNode);

      // Highlight affected nodes
      affectedNodeIds.clear();
      affectedNodeIds.add(impact.targetNode);
      impact.directImpact.forEach(n => affectedNodeIds.add(n.nodeId));
      impact.transitiveImpact.forEach(n => affectedNodeIds.add(n.nodeId));
      render();

      let html = '<div class="impact-section"><h4>📍 Target</h4>';
      html += '<div class="impact-item"><strong>' + (targetNode?.name || impact.targetNode) + '</strong>';
      html += '<div class="path">' + impact.change.changeType + ': ' + (impact.change.before || '') + ' → ' + (impact.change.after || 'deleted') + '</div></div></div>';

      html += '<div class="impact-section"><h4>⚠️ Risk Level</h4>';
      html += '<span class="risk-badge ' + impact.riskLevel + '">' + impact.riskLevel + '</span></div>';

      if (impact.breakingChanges.length > 0) {
        html += '<div class="impact-section"><h4>🔴 Breaking Changes (' + impact.breakingChanges.length + ')</h4>';
        impact.breakingChanges.forEach(bc => {
          html += '<div class="impact-item breaking" onclick="focusNode(\\''+bc.nodeId+'\\')">';
          html += '<strong>' + bc.reason + '</strong>';
          html += '<div class="path">' + bc.path + ':' + bc.line + '</div>';
          html += '<div class="patch-preview"><div class="patch-line remove">- ' + escapeHtml(bc.currentCode.trim()) + '</div></div>';
          html += '</div>';
        });
        html += '</div>';
      }

      if (impact.directImpact.length > 0) {
        html += '<div class="impact-section"><h4>🟡 Direct Impact (' + impact.directImpact.length + ')</h4>';
        impact.directImpact.forEach(di => {
          html += '<div class="impact-item warning" onclick="focusNode(\\''+di.nodeId+'\\')">';
          html += '<strong>' + di.nodeName + '</strong>';
          html += '<div class="path">' + di.path + '</div>';
          html += '<div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">' + di.description + '</div>';
          html += '</div>';
        });
        html += '</div>';
      }

      if (impact.suggestedFixes.length > 0) {
        html += '<div class="impact-section"><h4>🔧 Suggested Fixes (' + impact.suggestedFixes.length + ')</h4>';
        pendingPatches = impact.suggestedFixes.filter(f => f.autoFixable);
        impact.suggestedFixes.forEach(fix => {
          html += '<div class="impact-item" onclick="focusNode(\\''+fix.nodeId+'\\')">';
          html += '<strong>' + fix.description + '</strong>';
          html += '<div class="path">' + fix.path + ':' + fix.line + '</div>';
          if (fix.autoFixable) {
            html += '<div class="patch-preview">';
            html += '<div class="patch-line remove">- ' + escapeHtml(fix.oldCode.trim()) + '</div>';
            html += '<div class="patch-line add">+ ' + escapeHtml(fix.newCode.trim()) + '</div>';
            html += '</div>';
            html += '<div style="color: #22c55e; font-size: 11px; margin-top: 4px;">✓ Auto-fixable</div>';
          } else {
            html += '<div style="color: #f59e0b; font-size: 11px; margin-top: 4px;">⚠ Manual fix required</div>';
          }
          html += '</div>';
        });
        html += '</div>';
      }

      if (impact.transitiveImpact.length > 0) {
        html += '<div class="impact-section"><h4>🔵 Transitive Impact (' + impact.transitiveImpact.length + ')</h4>';
        impact.transitiveImpact.slice(0, 10).forEach(ti => {
          html += '<div class="impact-item" onclick="focusNode(\\''+ti.nodeId+'\\')">' + ti.nodeName + '<div class="path">' + ti.description + '</div></div>';
        });
        if (impact.transitiveImpact.length > 10) html += '<div style="color: #94a3b8; padding: 8px;">...and ' + (impact.transitiveImpact.length - 10) + ' more</div>';
        html += '</div>';
      }

      content.innerHTML = html;
      document.getElementById('apply-changes').disabled = pendingPatches.length === 0;
      document.getElementById('apply-changes').textContent = pendingPatches.length > 0 ? '✓ Apply ' + pendingPatches.length + ' Changes' : 'No Auto-fixes';
      panel.classList.add('open');
      document.getElementById('details-panel').classList.remove('open');
    }

    function escapeHtml(text) {
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    window.focusNode = function(nodeId) {
      const node = graphData.nodes.find(n => n.id === nodeId);
      if (node) {
        panX = canvas.width / 2 - node.position.x * zoom - 80;
        panY = canvas.height / 2 - node.position.y * zoom - 30;
        selectedNode = node;
        render();
      }
    };

    document.getElementById('close-impact').addEventListener('click', closeImpactPanel);
    document.getElementById('cancel-impact').addEventListener('click', closeImpactPanel);

    function closeImpactPanel() {
      document.getElementById('impact-panel').classList.remove('open');
      document.getElementById('mode-indicator').classList.remove('active');
      affectedNodeIds.clear();
      currentImpact = null;
      pendingPatches = [];
      render();
    }

    document.getElementById('apply-changes').addEventListener('click', () => {
      if (pendingPatches.length === 0) return;
      setLoading(true, 'Applying changes...');
      vscode.postMessage({ type: 'applyChanges', patches: pendingPatches });
    });

    // Highlight dependents/dependencies
    function highlightDependents(node) {
      affectedNodeIds.clear();
      affectedNodeIds.add(node.id);
      graphData.edges.filter(e => e.target === node.id).forEach(e => affectedNodeIds.add(e.source));
      document.getElementById('mode-indicator').textContent = '👆 ' + (affectedNodeIds.size - 1) + ' nodes depend on ' + node.name;
      document.getElementById('mode-indicator').classList.add('active');
      render();
    }

    function highlightDependencies(node) {
      affectedNodeIds.clear();
      affectedNodeIds.add(node.id);
      graphData.edges.filter(e => e.source === node.id).forEach(e => affectedNodeIds.add(e.target));
      document.getElementById('mode-indicator').textContent = '👇 ' + node.name + ' depends on ' + (affectedNodeIds.size - 1) + ' nodes';
      document.getElementById('mode-indicator').classList.add('active');
      render();
    }

    // Node details panel
    function showNodeDetails(node) {
      const panel = document.getElementById('details-panel');
      const title = document.getElementById('details-title');
      const content = document.getElementById('details-content');
      title.textContent = node.name;

      let html = '<div class="detail-section"><span class="node-type-badge" style="background: ' + typeColors[node.type] + '33; color: ' + typeColors[node.type] + ';">' + node.type + '</span></div>';
      html += '<div class="detail-section"><h4>File</h4><div class="detail-item" onclick="openFile(\\'' + node.path + '\\')">' + node.path + '</div></div>';
      if (node.linesOfCode) html += '<div class="detail-section"><h4>Size</h4><div>' + node.linesOfCode + ' lines</div></div>';
      if (node.exports?.length) {
        html += '<div class="detail-section"><h4>Exports (' + node.exports.length + ')</h4>';
        node.exports.forEach(e => html += '<div class="detail-item">' + e.name + ' (' + e.type + ')</div>');
        html += '</div>';
      }
      if (node.imports?.length) {
        html += '<div class="detail-section"><h4>Imports (' + node.imports.length + ')</h4>';
        node.imports.forEach(i => html += '<div class="detail-item">' + i.name + ' from ' + i.from + '</div>');
        html += '</div>';
      }
      if (node.props?.length) {
        html += '<div class="detail-section"><h4>Props (' + node.props.length + ')</h4>';
        node.props.forEach(p => html += '<div class="detail-item">' + p.name + (p.required ? '' : '?') + ': ' + p.type + '</div>');
        html += '</div>';
      }
      if (node.hooks?.length) {
        html += '<div class="detail-section"><h4>Hooks (' + node.hooks.length + ')</h4>';
        node.hooks.forEach(h => html += '<div class="detail-item">' + h + '</div>');
        html += '</div>';
      }
      content.innerHTML = html;
      panel.classList.add('open');
    }

    window.openFile = function(path) { vscode.postMessage({ type: 'openFile', path }); };

    document.getElementById('close-details').addEventListener('click', () => {
      document.getElementById('details-panel').classList.remove('open');
      selectedNode = null;
      render();
    });

    document.getElementById('btn-rename-node').addEventListener('click', () => { if (selectedNode) showRenameModal(selectedNode); });
    document.getElementById('btn-impact-node').addEventListener('click', () => { if (selectedNode) analyzeImpact(selectedNode, 'rename', selectedNode.name, selectedNode.name); });
    document.getElementById('btn-open-node').addEventListener('click', () => { if (selectedNode) vscode.postMessage({ type: 'openFile', path: selectedNode.path }); });

    // Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
      panX = mouseX - (mouseX - panX) * (newZoom / zoom);
      panY = mouseY - (mouseY - panY) * (newZoom / zoom);
      zoom = newZoom;
      render();
    });

    document.getElementById('zoom-in').addEventListener('click', () => { zoom = Math.min(3, zoom * 1.2); render(); });
    document.getElementById('zoom-out').addEventListener('click', () => { zoom = Math.max(0.1, zoom * 0.8); render(); });

    // Issues
    document.getElementById('btn-issues').addEventListener('click', () => document.getElementById('issues-panel').classList.toggle('open'));

    function showIssues(issues) {
      const list = document.getElementById('issues-list');
      if (!issues?.length) { list.innerHTML = '<div style="padding: 16px; color: #94a3b8;">No issues found! 🎉</div>'; return; }
      list.innerHTML = issues.map(issue => '<div class="issue-item" data-nodes="' + issue.nodeIds.join(',') + '"><div class="issue-severity ' + issue.severity + '"></div><div><div style="font-weight: 500;">' + issue.message + '</div>' + (issue.suggestion ? '<div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">💡 ' + issue.suggestion + '</div>' : '') + '</div></div>').join('');
      list.querySelectorAll('.issue-item').forEach(item => {
        item.addEventListener('click', () => {
          const nodeIds = item.dataset.nodes.split(',');
          if (nodeIds[0]) focusNode(nodeIds[0]);
        });
      });
    }

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!query || !graphData) { affectedNodeIds.clear(); render(); return; }
      const matches = graphData.nodes.filter(n => n.name.toLowerCase().includes(query) || n.path.toLowerCase().includes(query));
      affectedNodeIds.clear();
      matches.forEach(m => affectedNodeIds.add(m.id));
      if (matches.length > 0) focusNode(matches[0].id);
      render();
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));

    // Loading
    function setLoading(show, text) {
      const overlay = document.getElementById('loading-overlay');
      document.getElementById('loading-text').textContent = text || 'Loading...';
      if (show) overlay.classList.remove('hidden');
      else overlay.classList.add('hidden');
    }

    function updateStats(metadata) {
      document.getElementById('stat-files').textContent = metadata.totalFiles;
      document.getElementById('stat-nodes').textContent = metadata.totalNodes;
      document.getElementById('stat-edges').textContent = metadata.totalEdges;
      document.getElementById('stat-coherence').textContent = metadata.coherenceScore + '%';
      const fill = document.getElementById('coherence-fill');
      fill.style.width = metadata.coherenceScore + '%';
      fill.style.background = metadata.coherenceScore >= 80 ? '#22c55e' : (metadata.coherenceScore >= 60 ? '#eab308' : '#ef4444');
    }

    // Messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          graphData = message.data;
          updateStats(message.data.metadata);
          showIssues(message.data.metadata.issues);
          setLoading(false);
          render();
          break;
        case 'loading':
          setLoading(message.isLoading, message.text);
          break;
        case 'error':
          setLoading(false);
          alert('Error: ' + message.message);
          break;
        case 'impactResult':
          setLoading(false);
          showImpactPanel(message.data);
          break;
        case 'propagationResult':
          setLoading(false);
          if (message.data.success) {
            alert('✓ Applied ' + message.data.patchesApplied.length + ' changes successfully!\\n\\nModified files:\\n' + message.data.filesModified.join('\\n'));
            closeImpactPanel();
          } else {
            alert('⚠ Some changes failed:\\n' + message.data.errors.join('\\n'));
          }
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    MindMapPanelProvider.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
