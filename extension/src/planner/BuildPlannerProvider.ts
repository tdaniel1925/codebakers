/**
 * Build Planner Provider - Interactive AI-driven architecture planning
 *
 * A visual canvas where users design their application architecture with AI assistance.
 * The AI proactively suggests components, asks questions, and helps fill in details.
 */

import * as vscode from 'vscode';
import {
  Plan,
  PlanNode,
  PlanEdge,
  AIMessage,
  AISuggestion,
  PlanNodeType,
  EdgeType,
  PlanTemplate,
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
  NODE_DEFAULTS,
  NODE_COLORS,
  GenerationRequest,
} from './types';
import { AIPlanner } from './AIPlanner';
import { CodeGenerator } from './CodeGenerator';

// ============================================================================
// Build Planner Provider
// ============================================================================

export class BuildPlannerProvider {
  public static currentPanel: BuildPlannerProvider | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private plan: Plan;
  private aiPlanner: AIPlanner;
  private codeGenerator: CodeGenerator;
  private templates: PlanTemplate[];

  // ==========================================================================
  // Singleton Pattern
  // ==========================================================================

  public static createOrShow(extensionUri: vscode.Uri): BuildPlannerProvider {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (BuildPlannerProvider.currentPanel) {
      BuildPlannerProvider.currentPanel._panel.reveal(column);
      return BuildPlannerProvider.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'codebakers.buildPlanner',
      'CodeBakers Build Planner',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    BuildPlannerProvider.currentPanel = new BuildPlannerProvider(panel, extensionUri);
    return BuildPlannerProvider.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    console.log('BuildPlanner: Initializing...');

    // Initialize components (these must be initialized before try block for TypeScript)
    this.aiPlanner = new AIPlanner();
    console.log('BuildPlanner: AIPlanner initialized');

    this.codeGenerator = new CodeGenerator();
    console.log('BuildPlanner: CodeGenerator initialized');

    this.templates = this.getBuiltInTemplates();
    console.log('BuildPlanner: Templates loaded:', this.templates.length);

    // Create empty plan
    this.plan = this.createEmptyPlan();
    console.log('BuildPlanner: Empty plan created:', this.plan.id);

    try {

      // Set up webview content
      this._panel.webview.html = this._getHtmlForWebview();
      console.log('BuildPlanner: Webview HTML set');

      // Handle messages from webview
      this._panel.webview.onDidReceiveMessage(
        (message) => this.handleWebviewMessage(message),
        null,
        this._disposables
      );

      // Handle panel disposal
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

      console.log('BuildPlanner: Initialization complete');
    } catch (error) {
      console.error('BuildPlanner: Initialization failed:', error);
      vscode.window.showErrorMessage(`Build Planner initialization failed: ${error}`);
    }

    // Send initial data after webview is ready
    // (handled in 'ready' message)
  }

  // ==========================================================================
  // Message Handling
  // ==========================================================================

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    console.log('BuildPlanner: Received message:', message.type);

    try {
      switch (message.type) {
        case 'ready':
          await this.initializeWebview();
          break;

        case 'chat':
          await this.handleChat(message.content);
          break;

        case 'add-node':
          this.addNode(message.nodeType, message.position);
          break;

        case 'update-node':
          this.updateNode(message.nodeId, message.updates);
          break;

        case 'delete-node':
          this.deleteNode(message.nodeId);
          break;

        case 'add-edge':
          this.addEdge(message.source, message.target, message.edgeType);
          break;

        case 'delete-edge':
          this.deleteEdge(message.edgeId);
          break;

        case 'accept-suggestion':
          await this.acceptSuggestion(message.suggestionId);
          break;

        case 'dismiss-suggestion':
          this.dismissSuggestion(message.suggestionId);
          break;

        case 'accept-action':
          await this.acceptAction(message.actionId);
          break;

        case 'reject-action':
          this.rejectAction(message.actionId);
          break;

        case 'use-template':
          this.useTemplate(message.templateId);
          break;

        case 'generate':
          await this.generateCode(message.request);
          break;

        case 'save-plan':
          await this.savePlan();
          break;

        case 'load-plan':
          await this.loadPlan(message.planId);
          break;

        case 'new-plan':
          this.newPlan();
          break;

        case 'update-viewport':
          this.plan.viewport = message.viewport;
          break;

        case 'request-ai-review':
          await this.requestAIReview();
          break;

        case 'run-tests':
          await this.runProjectTests();
          break;

        default:
          console.warn('BuildPlanner: Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`BuildPlanner: Error handling message '${message.type}':`, errorMessage);
      console.error('BuildPlanner: Stack:', error instanceof Error ? error.stack : 'No stack trace');

      this.postMessage({
        type: 'error',
        message: `Error: ${errorMessage}`,
      });
    }
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  private async initializeWebview(): Promise<void> {
    console.log('BuildPlanner: Initializing webview...');

    try {
      // Send initial plan and templates
      console.log('BuildPlanner: Sending initial plan with', this.plan.nodes.length, 'nodes');
      this.postMessage({
        type: 'init',
        plan: this.plan,
        templates: this.templates,
      });

      // Send AI greeting
      console.log('BuildPlanner: Getting AI greeting...');
      const greeting = await this.aiPlanner.getInitialGreeting(this.plan);
      this.plan.messages.push(greeting);
      this.postMessage({ type: 'ai-message', message: greeting });
      console.log('BuildPlanner: Webview initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to initialize webview:', errorMessage);
      this.postMessage({
        type: 'error',
        message: 'Failed to initialize. Please try refreshing.',
      });
    }
  }

  // ==========================================================================
  // Chat Handling
  // ==========================================================================

  private async handleChat(content: string): Promise<void> {
    console.log('BuildPlanner: Processing chat message, length:', content.length);

    // Add user message to plan
    const userMessage: AIMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.plan.messages.push(userMessage);

    // Show typing indicator
    this.postMessage({ type: 'ai-typing', isTyping: true });

    try {
      // Get AI response
      console.log('BuildPlanner: Calling AI planner...');
      const aiMessage = await this.aiPlanner.chat(content, this.plan);
      console.log('BuildPlanner: AI response received, length:', aiMessage.content.length);

      this.plan.messages.push(aiMessage);

      // Hide typing indicator and send response
      this.postMessage({ type: 'ai-typing', isTyping: false });
      this.postMessage({ type: 'ai-message', message: aiMessage });

      // Check for new suggestions based on conversation
      this.checkForSuggestions();
      console.log('BuildPlanner: Chat handled successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Chat error:', errorMessage);
      console.error('BuildPlanner: Chat error stack:', error instanceof Error ? error.stack : 'No stack');

      this.postMessage({ type: 'ai-typing', isTyping: false });
      this.postMessage({
        type: 'error',
        message: 'Failed to get AI response. Please try again.',
      });
    }
  }

  // ==========================================================================
  // Node Operations
  // ==========================================================================

  private addNode(
    nodeType: PlanNodeType,
    position: { x: number; y: number }
  ): void {
    console.log('BuildPlanner: Adding node of type:', nodeType, 'at position:', position);

    try {
      const defaults = NODE_DEFAULTS[nodeType];
      const nodeNumber = this.plan.nodes.filter((n) => n.type === nodeType).length + 1;

      const newNode: PlanNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: nodeType,
        name: `New${this.capitalize(nodeType)}${nodeNumber}`,
        description: defaults.description || '',
        position,
        details: defaults.details ? { ...defaults.details } : {},
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Auto-fill details based on context
      console.log('BuildPlanner: Auto-filling node details...');
      const autoDetails = this.aiPlanner.autoFillNodeDetails(newNode, this.plan);
      newNode.details = { ...newNode.details, ...autoDetails };

      this.plan.nodes.push(newNode);
      this.plan.updatedAt = Date.now();

      // Check for auto-suggested edges
      console.log('BuildPlanner: Checking for suggested connections...');
      const suggestedEdges = this.aiPlanner.suggestConnectionsForNode(
        newNode,
        this.plan.nodes.filter((n) => n.id !== newNode.id)
      );

      suggestedEdges.forEach((edge) => {
        this.plan.edges.push(edge);
      });

      console.log('BuildPlanner: Node added successfully:', newNode.id, 'with', suggestedEdges.length, 'suggested edges');
      this.sendPlanUpdate();
      this.checkForSuggestions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to add node:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to add node: ${errorMessage}` });
    }
  }

  private updateNode(nodeId: string, updates: Partial<PlanNode>): void {
    console.log('BuildPlanner: Updating node:', nodeId);

    try {
      const nodeIndex = this.plan.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) {
        console.warn('BuildPlanner: Node not found for update:', nodeId);
        return;
      }

      this.plan.nodes[nodeIndex] = {
        ...this.plan.nodes[nodeIndex],
        ...updates,
        updatedAt: Date.now(),
      };
      this.plan.updatedAt = Date.now();

      console.log('BuildPlanner: Node updated successfully:', nodeId);
      this.sendPlanUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to update node:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to update node: ${errorMessage}` });
    }
  }

  private deleteNode(nodeId: string): void {
    console.log('BuildPlanner: Deleting node:', nodeId);

    try {
      const nodeExists = this.plan.nodes.some((n) => n.id === nodeId);
      if (!nodeExists) {
        console.warn('BuildPlanner: Node not found for deletion:', nodeId);
        return;
      }

      // Remove node
      this.plan.nodes = this.plan.nodes.filter((n) => n.id !== nodeId);

      // Remove connected edges
      const removedEdges = this.plan.edges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      );
      this.plan.edges = this.plan.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );

      this.plan.updatedAt = Date.now();
      console.log('BuildPlanner: Node deleted successfully:', nodeId, 'removed', removedEdges.length, 'edges');
      this.sendPlanUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to delete node:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to delete node: ${errorMessage}` });
    }
  }

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  private addEdge(source: string, target: string, edgeType: EdgeType): void {
    console.log('BuildPlanner: Adding edge:', source, '->', target, 'type:', edgeType);

    try {
      // Check if edge already exists
      const exists = this.plan.edges.some(
        (e) => e.source === source && e.target === target
      );
      if (exists) {
        console.warn('BuildPlanner: Edge already exists, skipping');
        return;
      }

      const newEdge: PlanEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source,
        target,
        type: edgeType,
        aiGenerated: false,
      };

      this.plan.edges.push(newEdge);
      this.plan.updatedAt = Date.now();

      console.log('BuildPlanner: Edge added successfully:', newEdge.id);
      this.sendPlanUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to add edge:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to add connection: ${errorMessage}` });
    }
  }

  private deleteEdge(edgeId: string): void {
    console.log('BuildPlanner: Deleting edge:', edgeId);

    try {
      const edgeExists = this.plan.edges.some((e) => e.id === edgeId);
      if (!edgeExists) {
        console.warn('BuildPlanner: Edge not found for deletion:', edgeId);
        return;
      }

      this.plan.edges = this.plan.edges.filter((e) => e.id !== edgeId);
      this.plan.updatedAt = Date.now();

      console.log('BuildPlanner: Edge deleted successfully:', edgeId);
      this.sendPlanUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to delete edge:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to delete connection: ${errorMessage}` });
    }
  }

  // ==========================================================================
  // Suggestion Handling
  // ==========================================================================

  private checkForSuggestions(): void {
    console.log('BuildPlanner: Checking for suggestions...');

    try {
      const newSuggestions = this.aiPlanner.analyzeAndSuggest(this.plan);
      let addedCount = 0;

      // Add non-duplicate suggestions
      newSuggestions.forEach((suggestion) => {
        const exists = this.plan.suggestions.some(
          (s) => s.title === suggestion.title && !s.dismissed
        );
        if (!exists) {
          this.plan.suggestions.push(suggestion);
          this.postMessage({ type: 'suggestion-added', suggestion });
          addedCount++;
        }
      });

      console.log('BuildPlanner: Found', newSuggestions.length, 'suggestions,', addedCount, 'new');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to check suggestions:', errorMessage);
    }
  }

  private async acceptSuggestion(suggestionId: string): Promise<void> {
    console.log('BuildPlanner: Accepting suggestion:', suggestionId);

    try {
      const suggestion = this.plan.suggestions.find((s) => s.id === suggestionId);
      if (!suggestion) {
        console.warn('BuildPlanner: Suggestion not found:', suggestionId);
        return;
      }

      // Add suggested nodes
      if (suggestion.suggestedNodes) {
        console.log('BuildPlanner: Adding', suggestion.suggestedNodes.length, 'suggested nodes');
        suggestion.suggestedNodes.forEach((nodeData, index) => {
          const position = {
            x: 100 + index * 200,
            y: 400 + Math.random() * 100,
          };

          const newNode: PlanNode = {
            id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: nodeData.type as PlanNodeType,
            name: nodeData.name || `New${this.capitalize(nodeData.type as string)}`,
            description: nodeData.description || '',
            position,
            details: nodeData.details || {},
            status: 'ai-suggested',
            aiGenerated: true,
            aiNotes: suggestion.description,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          this.plan.nodes.push(newNode);
        });
      }

      // Add suggested edges
      if (suggestion.suggestedEdges) {
        console.log('BuildPlanner: Adding', suggestion.suggestedEdges.length, 'suggested edges');
        suggestion.suggestedEdges.forEach((edgeData) => {
          const newEdge: PlanEdge = {
            id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            source: edgeData.source || '',
            target: edgeData.target || '',
            type: edgeData.type as EdgeType,
            aiGenerated: true,
          };

          this.plan.edges.push(newEdge);
        });
      }

      // Mark suggestion as handled
      suggestion.dismissed = true;
      this.postMessage({ type: 'suggestion-removed', suggestionId });

      this.plan.updatedAt = Date.now();
      console.log('BuildPlanner: Suggestion accepted successfully');
      this.sendPlanUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to accept suggestion:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to apply suggestion: ${errorMessage}` });
    }
  }

  private dismissSuggestion(suggestionId: string): void {
    console.log('BuildPlanner: Dismissing suggestion:', suggestionId);

    try {
      const suggestion = this.plan.suggestions.find((s) => s.id === suggestionId);
      if (suggestion) {
        suggestion.dismissed = true;
        this.postMessage({ type: 'suggestion-removed', suggestionId });
        console.log('BuildPlanner: Suggestion dismissed');
      } else {
        console.warn('BuildPlanner: Suggestion not found for dismissal:', suggestionId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to dismiss suggestion:', errorMessage);
    }
  }

  // ==========================================================================
  // Action Handling (from AI messages)
  // ==========================================================================

  private async acceptAction(actionId: string): Promise<void> {
    console.log('BuildPlanner: Accepting action:', actionId);

    try {
      // Find the action in recent messages
      for (const msg of this.plan.messages.slice().reverse()) {
        const action = msg.suggestedActions?.find((a) => a.id === actionId);
        if (action) {
          console.log('BuildPlanner: Found action type:', action.type);
          action.status = 'accepted';

          switch (action.type) {
            case 'add-node':
              this.addNode(action.payload.nodeType, { x: 300, y: 200 });
              break;
            case 'use-template':
              this.useTemplate(action.payload.templateId);
              break;
            case 'generate':
              await this.generateCode({
                planId: this.plan.id,
                nodes: [],
                dryRun: action.payload.dryRun ?? false,
                usePatterns: true,
              });
              break;
            default:
              console.warn('BuildPlanner: Unknown action type:', action.type);
          }
          console.log('BuildPlanner: Action accepted successfully');
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to accept action:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to perform action: ${errorMessage}` });
    }
  }

  private rejectAction(actionId: string): void {
    console.log('BuildPlanner: Rejecting action:', actionId);

    try {
      for (const msg of this.plan.messages) {
        const action = msg.suggestedActions?.find((a) => a.id === actionId);
        if (action) {
          action.status = 'rejected';
          console.log('BuildPlanner: Action rejected');
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to reject action:', errorMessage);
    }
  }

  // ==========================================================================
  // Template Handling
  // ==========================================================================

  private useTemplate(templateId: string): void {
    console.log('BuildPlanner: Loading template:', templateId);

    try {
      const template = this.templates.find((t) => t.id === templateId);
      if (!template) {
        console.warn('BuildPlanner: Template not found:', templateId);
        this.postMessage({ type: 'error', message: 'Template not found' });
        return;
      }

      // Clear existing nodes and edges
      console.log('BuildPlanner: Clearing existing plan, had', this.plan.nodes.length, 'nodes');
      this.plan.nodes = [];
      this.plan.edges = [];

      // Add template nodes with unique IDs
      const idMap = new Map<string, string>();

      template.nodes.forEach((nodeData, index) => {
        const newId = `node_${Date.now()}_${index}`;
        idMap.set(nodeData.name, newId);

        const newNode: PlanNode = {
          id: newId,
          type: nodeData.type,
          name: nodeData.name,
          description: nodeData.description,
          position: nodeData.position,
          details: { ...nodeData.details },
          status: 'draft',
          aiGenerated: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        this.plan.nodes.push(newNode);
      });

      console.log('BuildPlanner: Added', this.plan.nodes.length, 'template nodes');

      // Add template edges
      template.edges.forEach((edgeData, index) => {
        const sourceNode = this.plan.nodes.find((n) => n.name === edgeData.source);
        const targetNode = this.plan.nodes.find((n) => n.name === edgeData.target);

        if (sourceNode && targetNode) {
          const newEdge: PlanEdge = {
            id: `edge_${Date.now()}_${index}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: edgeData.type,
            aiGenerated: false,
          };

          this.plan.edges.push(newEdge);
        } else {
          console.warn('BuildPlanner: Could not find nodes for edge:', edgeData.source, '->', edgeData.target);
        }
      });

      console.log('BuildPlanner: Added', this.plan.edges.length, 'template edges');

      this.plan.templateId = templateId;
      this.plan.updatedAt = Date.now();

      this.sendPlanUpdate();

      // Send AI message about the template
      const templateMessage: AIMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Great choice! I've loaded the **${template.name}** template with ${this.plan.nodes.length} components.

Take a look at the canvas - you can:
- Click on any node to edit it
- Drag nodes to rearrange
- Add more nodes with the toolbar

What would you like to customize first?`,
        timestamp: Date.now(),
      };

      this.plan.messages.push(templateMessage);
      this.postMessage({ type: 'ai-message', message: templateMessage });
      console.log('BuildPlanner: Template loaded successfully:', template.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to load template:', errorMessage);
      this.postMessage({ type: 'error', message: `Failed to load template: ${errorMessage}` });
    }
  }

  // ==========================================================================
  // Code Generation
  // ==========================================================================

  private async generateCode(request: GenerationRequest): Promise<void> {
    console.log('BuildPlanner: Starting code generation, dryRun:', request.dryRun);

    if (this.plan.nodes.length === 0) {
      console.warn('BuildPlanner: Cannot generate code - no nodes in plan');
      this.postMessage({
        type: 'error',
        message: 'Add some nodes to your plan before generating code.',
      });
      return;
    }

    const nodeIds =
      request.nodes.length > 0
        ? request.nodes
        : this.plan.nodes.map((n) => n.id);

    console.log('BuildPlanner: Generating code for', nodeIds.length, 'nodes');
    this.postMessage({ type: 'generation-started', nodeIds });

    try {
      const result = await this.codeGenerator.generate(
        this.plan,
        { ...request, planId: this.plan.id },
        (nodeId, status, file) => {
          console.log('BuildPlanner: Generation progress:', nodeId, status, file?.path || '');
          this.postMessage({
            type: 'generation-progress',
            nodeId,
            status,
            file,
          });
        }
      );

      console.log('BuildPlanner: Generation completed:', result.files.length, 'files,', result.errors.length, 'errors');

      this.plan.generatedFiles = result.files;
      this.plan.status = result.success ? 'completed' : 'approved';

      this.postMessage({ type: 'generation-completed', result });

      // Update nodes with generated status
      result.files.forEach((file) => {
        const node = this.plan.nodes.find((n) => n.id === file.nodeId);
        if (node && file.status === 'written') {
          node.status = 'generated';
        }
      });

      this.sendPlanUpdate();

      // Show success message
      if (result.success) {
        console.log('BuildPlanner: Generation successful');
        vscode.window.showInformationMessage(
          `Generated ${result.files.length} files successfully!`
        );
      } else {
        console.warn('BuildPlanner: Generation completed with errors:', result.errors);
        vscode.window.showWarningMessage(
          `Generated ${result.files.length} files with ${result.errors.length} errors.`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Generation error:', errorMessage);
      console.error('BuildPlanner: Generation error stack:', error instanceof Error ? error.stack : 'No stack');
      this.postMessage({
        type: 'error',
        message: `Generation failed: ${errorMessage}`,
      });
    }
  }

  // ==========================================================================
  // AI Review
  // ==========================================================================

  private async requestAIReview(): Promise<void> {
    console.log('BuildPlanner: Requesting AI review of plan');
    this.postMessage({ type: 'ai-typing', isTyping: true });

    try {
      const reviewMessage = await this.aiPlanner.chat(
        'Please review my plan and tell me if anything is missing or could be improved.',
        this.plan
      );

      this.plan.messages.push(reviewMessage);
      this.postMessage({ type: 'ai-typing', isTyping: false });
      this.postMessage({ type: 'ai-message', message: reviewMessage });
      console.log('BuildPlanner: AI review completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: AI review failed:', errorMessage);
      this.postMessage({ type: 'ai-typing', isTyping: false });
      this.postMessage({
        type: 'error',
        message: 'Failed to get AI review. Please try again.',
      });
    }
  }

  // ==========================================================================
  // Test Runner
  // ==========================================================================

  private async runProjectTests(): Promise<void> {
    console.log('BuildPlanner: Running project tests');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.postMessage({
        type: 'error',
        message: 'No workspace folder open. Please open a project first.',
      });
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri;

    try {
      // Detect test framework
      const testFramework = await this.detectTestFramework(workspaceRoot);

      if (!testFramework) {
        this.postMessage({
          type: 'error',
          message: 'No test framework detected. Please ensure Playwright or Vitest is installed.',
        });
        return;
      }

      console.log('BuildPlanner: Detected test framework:', testFramework);

      // Send starting message
      const startMessage: AIMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `🧪 Running **${testFramework}** tests...\n\nI'll show you the results when they're done.`,
        timestamp: Date.now(),
      };
      this.plan.messages.push(startMessage);
      this.postMessage({ type: 'ai-message', message: startMessage });

      // Run tests in terminal
      const terminal = vscode.window.createTerminal({
        name: `CodeBakers Tests (${testFramework})`,
        cwd: workspaceRoot.fsPath,
      });

      let testCommand: string;
      switch (testFramework) {
        case 'playwright':
          testCommand = 'npx playwright test';
          break;
        case 'vitest':
          testCommand = 'npx vitest run';
          break;
        case 'jest':
          testCommand = 'npx jest';
          break;
        case 'mocha':
          testCommand = 'npx mocha';
          break;
        default:
          testCommand = 'npm test';
      }

      terminal.show();
      terminal.sendText(testCommand);

      // Send completion message
      const completeMessage: AIMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `Tests are running in the terminal. Check the **${testFramework.charAt(0).toUpperCase() + testFramework.slice(1)}** output for results.\n\n**Tip:** After tests complete, you can ask me about any failures and I'll help debug them.`,
        timestamp: Date.now(),
      };
      this.plan.messages.push(completeMessage);
      this.postMessage({ type: 'ai-message', message: completeMessage });

      console.log('BuildPlanner: Tests started in terminal');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to run tests:', errorMessage);
      this.postMessage({
        type: 'error',
        message: `Failed to run tests: ${errorMessage}`,
      });
    }
  }

  private async detectTestFramework(workspaceRoot: vscode.Uri): Promise<string | null> {
    const fs = vscode.workspace.fs;

    // Check for Playwright
    try {
      await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'playwright.config.ts'));
      return 'playwright';
    } catch {
      try {
        await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'playwright.config.js'));
        return 'playwright';
      } catch {
        // Not Playwright
      }
    }

    // Check for Vitest
    try {
      await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'vitest.config.ts'));
      return 'vitest';
    } catch {
      try {
        await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'vitest.config.js'));
        return 'vitest';
      } catch {
        try {
          await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'vite.config.ts'));
          // Check if vitest is in package.json
          const packageJsonUri = vscode.Uri.joinPath(workspaceRoot, 'package.json');
          const packageJsonData = await fs.readFile(packageJsonUri);
          const packageJson = JSON.parse(packageJsonData.toString());
          if (packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest) {
            return 'vitest';
          }
        } catch {
          // Not Vitest
        }
      }
    }

    // Check for Jest
    try {
      await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'jest.config.ts'));
      return 'jest';
    } catch {
      try {
        await fs.stat(vscode.Uri.joinPath(workspaceRoot, 'jest.config.js'));
        return 'jest';
      } catch {
        // Not Jest
      }
    }

    // Check package.json for test scripts
    try {
      const packageJsonUri = vscode.Uri.joinPath(workspaceRoot, 'package.json');
      const packageJsonData = await fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(packageJsonData.toString());

      if (packageJson.scripts?.test) {
        const testScript = packageJson.scripts.test;
        if (testScript.includes('playwright')) return 'playwright';
        if (testScript.includes('vitest')) return 'vitest';
        if (testScript.includes('jest')) return 'jest';
        if (testScript.includes('mocha')) return 'mocha';
        // Has a test script but unknown framework
        return 'npm';
      }

      // Check devDependencies
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (deps['@playwright/test']) return 'playwright';
      if (deps.vitest) return 'vitest';
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
    } catch {
      // No package.json or can't parse
    }

    return null;
  }

  // ==========================================================================
  // Plan Persistence
  // ==========================================================================

  private async savePlan(): Promise<void> {
    console.log('BuildPlanner: Saving plan:', this.plan.id);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.error('BuildPlanner: No workspace folder open for saving');
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const savePath = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      '.codebakers',
      'plans',
      `${this.plan.id}.json`
    );

    try {
      console.log('BuildPlanner: Creating plans directory...');
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(workspaceFolders[0].uri, '.codebakers', 'plans')
      );

      console.log('BuildPlanner: Writing plan file to:', savePath.fsPath);
      await vscode.workspace.fs.writeFile(
        savePath,
        Buffer.from(JSON.stringify(this.plan, null, 2), 'utf8')
      );

      console.log('BuildPlanner: Plan saved successfully');
      vscode.window.showInformationMessage('Plan saved successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Save error:', errorMessage);
      vscode.window.showErrorMessage(`Failed to save plan: ${errorMessage}`);
    }
  }

  private async loadPlan(planId: string): Promise<void> {
    console.log('BuildPlanner: Loading plan:', planId);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.error('BuildPlanner: No workspace folder open for loading');
      return;
    }

    const loadPath = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      '.codebakers',
      'plans',
      `${planId}.json`
    );

    try {
      console.log('BuildPlanner: Reading plan file from:', loadPath.fsPath);
      const data = await vscode.workspace.fs.readFile(loadPath);
      this.plan = JSON.parse(data.toString());
      console.log('BuildPlanner: Plan loaded successfully, nodes:', this.plan.nodes.length);
      this.sendPlanUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Load error:', errorMessage);
      vscode.window.showErrorMessage(`Failed to load plan: ${errorMessage}`);
    }
  }

  private newPlan(): void {
    console.log('BuildPlanner: Creating new plan');

    try {
      this.plan = this.createEmptyPlan();
      console.log('BuildPlanner: New plan created:', this.plan.id);
      this.sendPlanUpdate();

      // Send new greeting
      this.aiPlanner.getInitialGreeting(this.plan).then((greeting) => {
        this.plan.messages.push(greeting);
        this.postMessage({ type: 'ai-message', message: greeting });
        console.log('BuildPlanner: New plan greeting sent');
      }).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('BuildPlanner: Failed to get greeting for new plan:', errorMessage);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Failed to create new plan:', errorMessage);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private createEmptyPlan(): Plan {
    return {
      id: `plan_${Date.now()}`,
      name: 'Untitled Plan',
      description: '',
      status: 'planning',
      nodes: [],
      edges: [],
      messages: [],
      suggestions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }

  private sendPlanUpdate(): void {
    this.postMessage({ type: 'plan-updated', plan: this.plan });
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    this._panel.webview.postMessage(message);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ==========================================================================
  // Built-in Templates
  // ==========================================================================

  private getBuiltInTemplates(): PlanTemplate[] {
    return [
      {
        id: 'saas-starter',
        name: 'SaaS Starter',
        description: 'Authentication, billing, dashboard, and settings',
        category: 'saas',
        tags: ['auth', 'stripe', 'dashboard'],
        nodes: [
          { type: 'page', name: 'HomePage', description: 'Landing page', position: { x: 50, y: 50 }, details: { route: '/', isProtected: false }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'LoginPage', description: 'User login', position: { x: 250, y: 50 }, details: { route: '/login', isProtected: false }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'SignupPage', description: 'User registration', position: { x: 450, y: 50 }, details: { route: '/signup', isProtected: false }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'DashboardPage', description: 'Main dashboard', position: { x: 250, y: 200 }, details: { route: '/dashboard', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'SettingsPage', description: 'User settings', position: { x: 450, y: 200 }, details: { route: '/settings', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'AuthApi', description: 'Authentication endpoints', position: { x: 50, y: 350 }, details: { httpMethod: 'POST', requiresAuth: false }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'UsersApi', description: 'User management', position: { x: 250, y: 350 }, details: { httpMethod: 'GET', requiresAuth: true }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'BillingApi', description: 'Stripe billing', position: { x: 450, y: 350 }, details: { httpMethod: 'POST', requiresAuth: true }, status: 'draft', aiGenerated: false },
          { type: 'database', name: 'UsersTable', description: 'User accounts', position: { x: 150, y: 500 }, details: { tableName: 'users', columns: [{ name: 'id', type: 'serial', required: true }, { name: 'email', type: 'text', required: true }, { name: 'name', type: 'text', required: false }] }, status: 'draft', aiGenerated: false },
          { type: 'database', name: 'SubscriptionsTable', description: 'Billing subscriptions', position: { x: 350, y: 500 }, details: { tableName: 'subscriptions', columns: [{ name: 'id', type: 'serial', required: true }, { name: 'user_id', type: 'integer', required: true }, { name: 'status', type: 'text', required: true }] }, status: 'draft', aiGenerated: false },
        ],
        edges: [
          { source: 'LoginPage', target: 'AuthApi', type: 'calls', aiGenerated: false },
          { source: 'SignupPage', target: 'AuthApi', type: 'calls', aiGenerated: false },
          { source: 'DashboardPage', target: 'UsersApi', type: 'calls', aiGenerated: false },
          { source: 'SettingsPage', target: 'UsersApi', type: 'calls', aiGenerated: false },
          { source: 'SettingsPage', target: 'BillingApi', type: 'calls', aiGenerated: false },
          { source: 'AuthApi', target: 'UsersTable', type: 'mutates', aiGenerated: false },
          { source: 'UsersApi', target: 'UsersTable', type: 'queries', aiGenerated: false },
          { source: 'BillingApi', target: 'SubscriptionsTable', type: 'mutates', aiGenerated: false },
        ],
      },
      {
        id: 'ecommerce',
        name: 'E-commerce',
        description: 'Products, cart, checkout, and orders',
        category: 'ecommerce',
        tags: ['products', 'cart', 'stripe'],
        nodes: [
          { type: 'page', name: 'ProductsPage', description: 'Product catalog', position: { x: 50, y: 50 }, details: { route: '/products', isProtected: false }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'ProductDetailPage', description: 'Single product view', position: { x: 250, y: 50 }, details: { route: '/products/[id]', isProtected: false }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'CartPage', description: 'Shopping cart', position: { x: 450, y: 50 }, details: { route: '/cart', isProtected: false }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'CheckoutPage', description: 'Checkout flow', position: { x: 650, y: 50 }, details: { route: '/checkout', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'OrdersPage', description: 'Order history', position: { x: 450, y: 200 }, details: { route: '/orders', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'ProductsApi', description: 'Product CRUD', position: { x: 150, y: 350 }, details: { httpMethod: 'GET', requiresAuth: false }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'CartApi', description: 'Cart management', position: { x: 350, y: 350 }, details: { httpMethod: 'POST', requiresAuth: false }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'OrdersApi', description: 'Order processing', position: { x: 550, y: 350 }, details: { httpMethod: 'POST', requiresAuth: true }, status: 'draft', aiGenerated: false },
          { type: 'database', name: 'ProductsTable', description: 'Product catalog', position: { x: 150, y: 500 }, details: { tableName: 'products' }, status: 'draft', aiGenerated: false },
          { type: 'database', name: 'OrdersTable', description: 'Customer orders', position: { x: 350, y: 500 }, details: { tableName: 'orders' }, status: 'draft', aiGenerated: false },
          { type: 'database', name: 'OrderItemsTable', description: 'Order line items', position: { x: 550, y: 500 }, details: { tableName: 'order_items' }, status: 'draft', aiGenerated: false },
        ],
        edges: [
          { source: 'ProductsPage', target: 'ProductsApi', type: 'calls', aiGenerated: false },
          { source: 'ProductDetailPage', target: 'ProductsApi', type: 'calls', aiGenerated: false },
          { source: 'CartPage', target: 'CartApi', type: 'calls', aiGenerated: false },
          { source: 'CheckoutPage', target: 'OrdersApi', type: 'calls', aiGenerated: false },
          { source: 'OrdersPage', target: 'OrdersApi', type: 'calls', aiGenerated: false },
          { source: 'ProductsApi', target: 'ProductsTable', type: 'queries', aiGenerated: false },
          { source: 'OrdersApi', target: 'OrdersTable', type: 'mutates', aiGenerated: false },
          { source: 'OrdersApi', target: 'OrderItemsTable', type: 'mutates', aiGenerated: false },
        ],
      },
      {
        id: 'dashboard',
        name: 'Admin Dashboard',
        description: 'Data tables, charts, and CRUD operations',
        category: 'dashboard',
        tags: ['admin', 'analytics', 'crud'],
        nodes: [
          { type: 'page', name: 'OverviewPage', description: 'Dashboard overview', position: { x: 250, y: 50 }, details: { route: '/admin', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'UsersAdminPage', description: 'User management', position: { x: 50, y: 200 }, details: { route: '/admin/users', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'AnalyticsPage', description: 'Analytics dashboard', position: { x: 250, y: 200 }, details: { route: '/admin/analytics', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'page', name: 'SettingsAdminPage', description: 'System settings', position: { x: 450, y: 200 }, details: { route: '/admin/settings', isProtected: true }, status: 'draft', aiGenerated: false },
          { type: 'component', name: 'DataTable', description: 'Reusable data table', position: { x: 50, y: 350 }, details: { props: [{ name: 'data', type: 'any[]', required: true }, { name: 'columns', type: 'Column[]', required: true }] }, status: 'draft', aiGenerated: false },
          { type: 'component', name: 'StatsCard', description: 'Statistics card', position: { x: 250, y: 350 }, details: { props: [{ name: 'title', type: 'string', required: true }, { name: 'value', type: 'number', required: true }] }, status: 'draft', aiGenerated: false },
          { type: 'component', name: 'Chart', description: 'Chart component', position: { x: 450, y: 350 }, details: { props: [{ name: 'type', type: 'string', required: true }, { name: 'data', type: 'ChartData', required: true }] }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'StatsApi', description: 'Dashboard statistics', position: { x: 150, y: 500 }, details: { httpMethod: 'GET', requiresAuth: true }, status: 'draft', aiGenerated: false },
          { type: 'api', name: 'AdminUsersApi', description: 'Admin user management', position: { x: 350, y: 500 }, details: { httpMethod: 'GET', requiresAuth: true }, status: 'draft', aiGenerated: false },
        ],
        edges: [
          { source: 'OverviewPage', target: 'StatsCard', type: 'renders', aiGenerated: false },
          { source: 'OverviewPage', target: 'Chart', type: 'renders', aiGenerated: false },
          { source: 'UsersAdminPage', target: 'DataTable', type: 'renders', aiGenerated: false },
          { source: 'AnalyticsPage', target: 'Chart', type: 'renders', aiGenerated: false },
          { source: 'OverviewPage', target: 'StatsApi', type: 'calls', aiGenerated: false },
          { source: 'UsersAdminPage', target: 'AdminUsersApi', type: 'calls', aiGenerated: false },
        ],
      },
    ];
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  public dispose(): void {
    console.log('BuildPlanner: Disposing...');

    try {
      BuildPlannerProvider.currentPanel = undefined;

      this._panel.dispose();

      while (this._disposables.length) {
        const disposable = this._disposables.pop();
        if (disposable) {
          disposable.dispose();
        }
      }

      console.log('BuildPlanner: Disposed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('BuildPlanner: Error during disposal:', errorMessage);
    }
  }

  // ==========================================================================
  // Webview HTML
  // ==========================================================================

  private _getHtmlForWebview(): string {
    const nodeColorsJson = JSON.stringify(NODE_COLORS);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeBakers Build Planner</title>
  <style>
    :root {
      --bg: #1e1e1e;
      --surface: #252526;
      --surface-hover: #2d2d2d;
      --border: #3e3e42;
      --text: #cccccc;
      --text-muted: #858585;
      --primary: #0e7490;
      --primary-light: #22d3ee;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
    }

    .container {
      display: flex;
      height: 100vh;
    }

    /* Canvas Area */
    .canvas-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }

    .toolbar-group {
      display: flex;
      gap: 4px;
      padding-right: 12px;
      border-right: 1px solid var(--border);
    }

    .toolbar-group:last-child {
      border-right: none;
    }

    .toolbar-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .toolbar-btn:hover {
      background: var(--border);
    }

    .toolbar-btn.active {
      background: var(--primary);
      border-color: var(--primary);
    }

    .toolbar-btn.primary {
      background: var(--primary);
      border-color: var(--primary);
    }

    .toolbar-btn.primary:hover {
      background: var(--primary-light);
    }

    .canvas-container {
      flex: 1;
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(90deg, var(--border) 1px, transparent 1px),
        linear-gradient(var(--border) 1px, transparent 1px);
      background-size: 20px 20px;
    }

    .canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    /* Nodes */
    .node {
      position: absolute;
      min-width: 180px;
      background: var(--surface);
      border: 2px solid var(--border);
      border-radius: 8px;
      cursor: move;
      transition: box-shadow 0.15s;
      user-select: none;
    }

    .node:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .node.selected {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.3);
    }

    .node.ai-suggested {
      border-style: dashed;
      opacity: 0.85;
    }

    .node-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 6px 6px 0 0;
      font-weight: 500;
      font-size: 13px;
    }

    .node-icon {
      font-size: 16px;
    }

    .node-type {
      font-size: 10px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-left: auto;
    }

    .node-body {
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-muted);
      border-top: 1px solid var(--border);
    }

    .node-status {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      font-size: 10px;
      border-top: 1px solid var(--border);
    }

    .node-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .node-status-dot.draft { background: var(--text-muted); }
    .node-status-dot.ai-suggested { background: var(--warning); }
    .node-status-dot.approved { background: var(--primary); }
    .node-status-dot.generated { background: var(--success); }

    /* Connection Points */
    .connection-point {
      position: absolute;
      width: 12px;
      height: 12px;
      background: var(--primary);
      border: 2px solid var(--bg);
      border-radius: 50%;
      cursor: crosshair;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .node:hover .connection-point {
      opacity: 1;
    }

    .connection-point.top { top: -6px; left: 50%; transform: translateX(-50%); }
    .connection-point.right { right: -6px; top: 50%; transform: translateY(-50%); }
    .connection-point.bottom { bottom: -6px; left: 50%; transform: translateX(-50%); }
    .connection-point.left { left: -6px; top: 50%; transform: translateY(-50%); }

    /* Edges (SVG) */
    .edges-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .edge {
      fill: none;
      stroke: var(--border);
      stroke-width: 2;
      pointer-events: stroke;
      cursor: pointer;
    }

    .edge:hover {
      stroke: var(--primary);
    }

    .edge.ai-generated {
      stroke-dasharray: 5 5;
    }

    /* Chat Panel */
    .chat-panel {
      width: 380px;
      display: flex;
      flex-direction: column;
      background: var(--surface);
      border-left: 1px solid var(--border);
    }

    .chat-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      font-weight: 500;
    }

    .chat-header-icon {
      font-size: 18px;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .message {
      max-width: 90%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
    }

    .message.user {
      align-self: flex-end;
      background: var(--primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant {
      align-self: flex-start;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }

    .message-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .message-action {
      padding: 6px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .message-action:hover {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    .typing-indicator {
      display: none;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      align-self: flex-start;
    }

    .typing-indicator.show {
      display: flex;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: var(--text-muted);
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-4px); }
    }

    .chat-input-area {
      padding: 12px;
      border-top: 1px solid var(--border);
    }

    .chat-input-wrapper {
      display: flex;
      gap: 8px;
    }

    .chat-input {
      flex: 1;
      padding: 10px 14px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .chat-input:focus {
      border-color: var(--primary);
    }

    .chat-send {
      padding: 10px 16px;
      background: var(--primary);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .chat-send:hover {
      background: var(--primary-light);
    }

    /* Suggestions Panel */
    .suggestions {
      padding: 0 16px 16px;
    }

    .suggestion {
      padding: 10px 12px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .suggestion-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .suggestion-severity {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      text-transform: uppercase;
    }

    .suggestion-severity.warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .suggestion-severity.info { background: rgba(14, 116, 144, 0.2); color: var(--primary-light); }
    .suggestion-severity.critical { background: rgba(239, 68, 68, 0.2); color: var(--error); }

    .suggestion-title {
      font-weight: 500;
      font-size: 13px;
    }

    .suggestion-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .suggestion-actions {
      display: flex;
      gap: 8px;
    }

    .suggestion-btn {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .suggestion-btn.accept {
      background: var(--primary);
      border: none;
      color: white;
    }

    .suggestion-btn.dismiss {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }

    /* Node Edit Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.show {
      display: flex;
    }

    .modal {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      border-bottom: 1px solid var(--border);
    }

    .modal-title {
      font-weight: 600;
      font-size: 16px;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 20px;
      cursor: pointer;
    }

    .modal-body {
      padding: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .form-input:focus {
      border-color: var(--primary);
    }

    .form-select {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--border);
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-secondary {
      background: var(--surface-hover);
      border: 1px solid var(--border);
      color: var(--text);
    }

    .btn-primary {
      background: var(--primary);
      border: none;
      color: white;
    }

    .btn-danger {
      background: var(--error);
      border: none;
      color: white;
    }

    /* Templates Panel */
    .templates-panel {
      display: none;
      position: absolute;
      top: 60px;
      left: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      width: 300px;
      z-index: 100;
    }

    .templates-panel.show {
      display: block;
    }

    .template-card {
      padding: 12px;
      background: var(--surface-hover);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .template-card:hover {
      border-color: var(--primary);
    }

    .template-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .template-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Generation Progress */
    .generation-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 2000;
      align-items: center;
      justify-content: center;
    }

    .generation-overlay.show {
      display: flex;
    }

    .generation-modal {
      background: var(--surface);
      border-radius: 12px;
      padding: 24px;
      width: 400px;
      text-align: center;
    }

    .generation-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .generation-progress {
      margin-bottom: 16px;
    }

    .progress-bar {
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: var(--primary);
      transition: width 0.3s;
    }

    .progress-text {
      font-size: 12px;
      color: var(--text-muted);
    }

    .generation-files {
      text-align: left;
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
    }

    .generation-file {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
    }

    .file-status {
      width: 16px;
      height: 16px;
    }

    .file-status.pending { color: var(--text-muted); }
    .file-status.generating { color: var(--warning); animation: spin 1s linear infinite; }
    .file-status.done { color: var(--success); }
    .file-status.error { color: var(--error); }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Canvas Area -->
    <div class="canvas-area">
      <div class="toolbar">
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="setMode('select')" id="mode-select">
            <span>↖️</span> Select
          </button>
          <button class="toolbar-btn" onclick="setMode('pan')" id="mode-pan">
            <span>✋</span> Pan
          </button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="showAddNodeMenu()">
            <span>➕</span> Add Node
          </button>
          <button class="toolbar-btn" onclick="toggleTemplates()">
            <span>📋</span> Templates
          </button>
        </div>
        <div class="toolbar-group">
          <button class="toolbar-btn" onclick="requestReview()">
            <span>🔍</span> AI Review
          </button>
          <button class="toolbar-btn" onclick="runTests()">
            <span>🧪</span> Run Tests
          </button>
          <button class="toolbar-btn primary" onclick="generateCode()">
            <span>⚡</span> Generate
          </button>
        </div>
      </div>

      <div class="canvas-container" id="canvas-container">
        <svg class="edges-layer" id="edges-layer"></svg>
        <div class="canvas" id="canvas"></div>
      </div>

      <!-- Templates Panel -->
      <div class="templates-panel" id="templates-panel">
        <h3 style="margin-bottom: 12px;">Templates</h3>
        <div id="templates-list"></div>
      </div>
    </div>

    <!-- Chat Panel -->
    <div class="chat-panel">
      <div class="chat-header">
        <span class="chat-header-icon">🤖</span>
        <span>AI Architect</span>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="typing-indicator" id="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>

      <div class="suggestions" id="suggestions"></div>

      <div class="chat-input-area">
        <div class="chat-input-wrapper">
          <input
            type="text"
            class="chat-input"
            id="chat-input"
            placeholder="Describe what you're building..."
            onkeypress="handleChatKeypress(event)"
          />
          <button class="chat-send" onclick="sendChat()">Send</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Node Edit Modal -->
  <div class="modal-overlay" id="node-modal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Edit Node</span>
        <button class="modal-close" onclick="closeNodeModal()">&times;</button>
      </div>
      <div class="modal-body" id="node-modal-body">
        <!-- Dynamic content -->
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" onclick="deleteSelectedNode()">Delete</button>
        <button class="btn btn-secondary" onclick="closeNodeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNodeChanges()">Save</button>
      </div>
    </div>
  </div>

  <!-- Add Node Menu -->
  <div class="modal-overlay" id="add-node-modal">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Add Node</span>
        <button class="modal-close" onclick="closeAddNodeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Node Type</label>
          <select class="form-select" id="new-node-type">
            <option value="page">📄 Page</option>
            <option value="component">🧩 Component</option>
            <option value="api">🔌 API Route</option>
            <option value="database">🗄️ Database Table</option>
            <option value="type">📝 Type/Interface</option>
            <option value="hook">🪝 Hook</option>
            <option value="service">⚙️ Service</option>
            <option value="context">🌐 Context</option>
            <option value="action">⚡ Server Action</option>
            <option value="middleware">🔀 Middleware</option>
            <option value="job">⏰ Background Job</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" id="new-node-name" placeholder="e.g., UserProfile" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="new-node-desc" placeholder="Brief description..." />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeAddNodeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="addNodeFromModal()">Add Node</button>
      </div>
    </div>
  </div>

  <!-- Generation Progress -->
  <div class="generation-overlay" id="generation-overlay">
    <div class="generation-modal">
      <div class="generation-title">Generating Code...</div>
      <div class="generation-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="generation-progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-text" id="generation-progress-text">Preparing...</div>
      </div>
      <div class="generation-files" id="generation-files"></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const NODE_COLORS = ${nodeColorsJson};

    let plan = null;
    let templates = [];
    let selectedNodeId = null;
    let mode = 'select';
    let isDragging = false;
    let dragNode = null;
    let dragOffset = { x: 0, y: 0 };
    let generatingNodes = new Set();

    // Initialize
    window.addEventListener('message', event => {
      const message = event.data;
      handleExtensionMessage(message);
    });

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    function handleExtensionMessage(message) {
      switch (message.type) {
        case 'init':
          plan = message.plan;
          templates = message.templates;
          renderPlan();
          renderTemplates();
          break;

        case 'plan-updated':
          plan = message.plan;
          renderPlan();
          break;

        case 'ai-message':
          addChatMessage(message.message);
          break;

        case 'ai-typing':
          document.getElementById('typing-indicator').classList.toggle('show', message.isTyping);
          scrollChat();
          break;

        case 'suggestion-added':
          renderSuggestions();
          break;

        case 'suggestion-removed':
          renderSuggestions();
          break;

        case 'generation-started':
          showGenerationOverlay(message.nodeIds);
          break;

        case 'generation-progress':
          updateGenerationProgress(message.nodeId, message.status, message.file);
          break;

        case 'generation-completed':
          hideGenerationOverlay(message.result);
          break;

        case 'error':
          alert(message.message);
          break;
      }
    }

    // Rendering
    function renderPlan() {
      if (!plan) return;

      const canvas = document.getElementById('canvas');
      canvas.innerHTML = '';

      // Render nodes
      plan.nodes.forEach(node => {
        const nodeEl = createNodeElement(node);
        canvas.appendChild(nodeEl);
      });

      // Render edges
      renderEdges();
    }

    function createNodeElement(node) {
      const colors = NODE_COLORS[node.type];
      const el = document.createElement('div');
      el.className = 'node' + (node.aiGenerated ? ' ai-suggested' : '') + (node.id === selectedNodeId ? ' selected' : '');
      el.id = 'node-' + node.id;
      el.style.left = node.position.x + 'px';
      el.style.top = node.position.y + 'px';

      el.innerHTML = \`
        <div class="node-header" style="background: \${colors.bg}; border-color: \${colors.border};">
          <span class="node-icon">\${colors.icon}</span>
          <span class="node-name">\${node.name}</span>
          <span class="node-type">\${node.type}</span>
        </div>
        <div class="node-body">\${node.description || 'No description'}</div>
        <div class="node-status">
          <span class="node-status-dot \${node.status}"></span>
          <span>\${node.status}</span>
        </div>
        <div class="connection-point top" data-pos="top"></div>
        <div class="connection-point right" data-pos="right"></div>
        <div class="connection-point bottom" data-pos="bottom"></div>
        <div class="connection-point left" data-pos="left"></div>
      \`;

      // Event listeners
      el.addEventListener('mousedown', e => handleNodeMouseDown(e, node));
      el.addEventListener('dblclick', () => openNodeModal(node));

      return el;
    }

    function renderEdges() {
      const svg = document.getElementById('edges-layer');
      svg.innerHTML = '';

      plan.edges.forEach(edge => {
        const sourceNode = plan.nodes.find(n => n.id === edge.source);
        const targetNode = plan.nodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return;

        const sourceEl = document.getElementById('node-' + edge.source);
        const targetEl = document.getElementById('node-' + edge.target);

        if (!sourceEl || !targetEl) return;

        const sourceRect = {
          x: sourceNode.position.x + sourceEl.offsetWidth / 2,
          y: sourceNode.position.y + sourceEl.offsetHeight
        };

        const targetRect = {
          x: targetNode.position.x + targetEl.offsetWidth / 2,
          y: targetNode.position.y
        };

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const midY = (sourceRect.y + targetRect.y) / 2;
        path.setAttribute('d', \`M \${sourceRect.x} \${sourceRect.y} C \${sourceRect.x} \${midY}, \${targetRect.x} \${midY}, \${targetRect.x} \${targetRect.y}\`);
        path.setAttribute('class', 'edge' + (edge.aiGenerated ? ' ai-generated' : ''));
        path.setAttribute('data-edge-id', edge.id);

        svg.appendChild(path);
      });
    }

    function renderTemplates() {
      const list = document.getElementById('templates-list');
      list.innerHTML = '';

      templates.forEach(template => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = \`
          <div class="template-name">\${template.name}</div>
          <div class="template-desc">\${template.description}</div>
        \`;
        card.onclick = () => useTemplate(template.id);
        list.appendChild(card);
      });
    }

    function renderSuggestions() {
      const container = document.getElementById('suggestions');
      container.innerHTML = '';

      if (!plan) return;

      const activeSuggestions = plan.suggestions.filter(s => !s.dismissed);

      activeSuggestions.forEach(suggestion => {
        const el = document.createElement('div');
        el.className = 'suggestion';
        el.innerHTML = \`
          <div class="suggestion-header">
            <span class="suggestion-severity \${suggestion.severity}">\${suggestion.severity}</span>
            <span class="suggestion-title">\${suggestion.title}</span>
          </div>
          <div class="suggestion-desc">\${suggestion.description}</div>
          <div class="suggestion-actions">
            <button class="suggestion-btn accept" onclick="acceptSuggestion('\${suggestion.id}')">Add</button>
            <button class="suggestion-btn dismiss" onclick="dismissSuggestion('\${suggestion.id}')">Dismiss</button>
          </div>
        \`;
        container.appendChild(el);
      });
    }

    // Chat
    function addChatMessage(message) {
      const container = document.getElementById('chat-messages');
      const typing = document.getElementById('typing-indicator');

      const el = document.createElement('div');
      el.className = 'message ' + message.role;
      el.innerHTML = formatMessage(message.content);

      if (message.suggestedActions && message.suggestedActions.length > 0) {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'message-actions';

        message.suggestedActions.forEach(action => {
          if (action.status === 'pending') {
            const btn = document.createElement('button');
            btn.className = 'message-action';
            btn.textContent = action.label;
            btn.onclick = () => acceptAction(action.id);
            actionsEl.appendChild(btn);
          }
        });

        el.appendChild(actionsEl);
      }

      container.insertBefore(el, typing);
      scrollChat();
    }

    function formatMessage(content) {
      // Simple markdown formatting
      return content
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/\\n/g, '<br>');
    }

    function sendChat() {
      const input = document.getElementById('chat-input');
      const content = input.value.trim();

      if (!content) return;

      // Add user message locally
      addChatMessage({ role: 'user', content, timestamp: Date.now() });

      // Send to extension
      vscode.postMessage({ type: 'chat', content });

      input.value = '';
    }

    function handleChatKeypress(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    }

    function scrollChat() {
      const container = document.getElementById('chat-messages');
      container.scrollTop = container.scrollHeight;
    }

    // Node interactions
    function handleNodeMouseDown(e, node) {
      if (e.target.classList.contains('connection-point')) {
        // Start connection
        return;
      }

      if (mode === 'select') {
        selectedNodeId = node.id;
        renderPlan();

        // Start drag
        isDragging = true;
        dragNode = node;
        dragOffset = {
          x: e.clientX - node.position.x,
          y: e.clientY - node.position.y
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    }

    function handleMouseMove(e) {
      if (!isDragging || !dragNode) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Update node position
      dragNode.position.x = Math.max(0, newX);
      dragNode.position.y = Math.max(0, newY);

      // Update DOM
      const el = document.getElementById('node-' + dragNode.id);
      if (el) {
        el.style.left = dragNode.position.x + 'px';
        el.style.top = dragNode.position.y + 'px';
      }

      // Update edges
      renderEdges();
    }

    function handleMouseUp() {
      if (isDragging && dragNode) {
        // Send position update to extension
        vscode.postMessage({
          type: 'update-node',
          nodeId: dragNode.id,
          updates: { position: dragNode.position }
        });
      }

      isDragging = false;
      dragNode = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    function openNodeModal(node) {
      selectedNodeId = node.id;

      const body = document.getElementById('node-modal-body');
      body.innerHTML = \`
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" class="form-input" id="edit-node-name" value="\${node.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" class="form-input" id="edit-node-desc" value="\${node.description || ''}" />
        </div>
        \${getTypeSpecificFields(node)}
      \`;

      document.getElementById('node-modal').classList.add('show');
    }

    function getTypeSpecificFields(node) {
      let html = '';

      switch (node.type) {
        case 'page':
          html = \`
            <div class="form-group">
              <label class="form-label">Route</label>
              <input type="text" class="form-input" id="edit-route" value="\${node.details.route || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="edit-protected" \${node.details.isProtected ? 'checked' : ''} />
                Protected (requires auth)
              </label>
            </div>
          \`;
          break;

        case 'api':
          html = \`
            <div class="form-group">
              <label class="form-label">HTTP Method</label>
              <select class="form-select" id="edit-method">
                <option value="GET" \${node.details.httpMethod === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" \${node.details.httpMethod === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" \${node.details.httpMethod === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="PATCH" \${node.details.httpMethod === 'PATCH' ? 'selected' : ''}>PATCH</option>
                <option value="DELETE" \${node.details.httpMethod === 'DELETE' ? 'selected' : ''}>DELETE</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" id="edit-requires-auth" \${node.details.requiresAuth ? 'checked' : ''} />
                Requires Authentication
              </label>
            </div>
          \`;
          break;

        case 'database':
          html = \`
            <div class="form-group">
              <label class="form-label">Table Name</label>
              <input type="text" class="form-input" id="edit-table-name" value="\${node.details.tableName || ''}" />
            </div>
          \`;
          break;
      }

      return html;
    }

    function closeNodeModal() {
      document.getElementById('node-modal').classList.remove('show');
    }

    function saveNodeChanges() {
      if (!selectedNodeId) return;

      const updates = {
        name: document.getElementById('edit-node-name').value,
        description: document.getElementById('edit-node-desc').value,
        details: {}
      };

      const node = plan.nodes.find(n => n.id === selectedNodeId);

      // Get type-specific fields
      if (node.type === 'page') {
        updates.details.route = document.getElementById('edit-route')?.value;
        updates.details.isProtected = document.getElementById('edit-protected')?.checked;
      } else if (node.type === 'api') {
        updates.details.httpMethod = document.getElementById('edit-method')?.value;
        updates.details.requiresAuth = document.getElementById('edit-requires-auth')?.checked;
      } else if (node.type === 'database') {
        updates.details.tableName = document.getElementById('edit-table-name')?.value;
      }

      vscode.postMessage({ type: 'update-node', nodeId: selectedNodeId, updates });
      closeNodeModal();
    }

    function deleteSelectedNode() {
      if (!selectedNodeId) return;

      vscode.postMessage({ type: 'delete-node', nodeId: selectedNodeId });
      closeNodeModal();
      selectedNodeId = null;
    }

    // Add Node
    function showAddNodeMenu() {
      document.getElementById('add-node-modal').classList.add('show');
    }

    function closeAddNodeModal() {
      document.getElementById('add-node-modal').classList.remove('show');
    }

    function addNodeFromModal() {
      const nodeType = document.getElementById('new-node-type').value;
      const name = document.getElementById('new-node-name').value || ('New' + nodeType.charAt(0).toUpperCase() + nodeType.slice(1));
      const description = document.getElementById('new-node-desc').value;

      // Calculate position (center of visible canvas)
      const canvas = document.getElementById('canvas-container');
      const position = {
        x: canvas.scrollLeft + canvas.offsetWidth / 2 - 90,
        y: canvas.scrollTop + canvas.offsetHeight / 2 - 50
      };

      vscode.postMessage({ type: 'add-node', nodeType, position });
      closeAddNodeModal();

      // Clear form
      document.getElementById('new-node-name').value = '';
      document.getElementById('new-node-desc').value = '';
    }

    // Templates
    function toggleTemplates() {
      document.getElementById('templates-panel').classList.toggle('show');
    }

    function useTemplate(templateId) {
      vscode.postMessage({ type: 'use-template', templateId });
      document.getElementById('templates-panel').classList.remove('show');
    }

    // Suggestions
    function acceptSuggestion(suggestionId) {
      vscode.postMessage({ type: 'accept-suggestion', suggestionId });
    }

    function dismissSuggestion(suggestionId) {
      vscode.postMessage({ type: 'dismiss-suggestion', suggestionId });
    }

    // Actions
    function acceptAction(actionId) {
      vscode.postMessage({ type: 'accept-action', actionId });
    }

    // AI Review
    function requestReview() {
      vscode.postMessage({ type: 'request-ai-review' });
    }

    // Run Tests
    function runTests() {
      vscode.postMessage({ type: 'run-tests' });
    }

    // Generation
    function generateCode() {
      if (!plan || plan.nodes.length === 0) {
        alert('Add some nodes to your plan first!');
        return;
      }

      vscode.postMessage({
        type: 'generate',
        request: {
          planId: plan.id,
          nodes: [],
          dryRun: false,
          usePatterns: true
        }
      });
    }

    function showGenerationOverlay(nodeIds) {
      generatingNodes = new Set(nodeIds);

      const filesContainer = document.getElementById('generation-files');
      filesContainer.innerHTML = '';

      nodeIds.forEach(nodeId => {
        const node = plan.nodes.find(n => n.id === nodeId);
        if (node) {
          const el = document.createElement('div');
          el.className = 'generation-file';
          el.id = 'gen-file-' + nodeId;
          el.innerHTML = \`
            <span class="file-status pending">⏳</span>
            <span>\${node.name}</span>
          \`;
          filesContainer.appendChild(el);
        }
      });

      document.getElementById('generation-overlay').classList.add('show');
      updateProgressBar();
    }

    function updateGenerationProgress(nodeId, status, file) {
      const el = document.getElementById('gen-file-' + nodeId);
      if (el) {
        const statusIcon = el.querySelector('.file-status');

        switch (status) {
          case 'generating':
            statusIcon.textContent = '⏳';
            statusIcon.className = 'file-status generating';
            break;
          case 'done':
            statusIcon.textContent = '✅';
            statusIcon.className = 'file-status done';
            generatingNodes.delete(nodeId);
            break;
          case 'error':
            statusIcon.textContent = '❌';
            statusIcon.className = 'file-status error';
            generatingNodes.delete(nodeId);
            break;
        }

        if (file && file.path) {
          el.querySelector('span:last-child').textContent = file.path;
        }
      }

      updateProgressBar();
    }

    function updateProgressBar() {
      const total = plan.nodes.length;
      const done = total - generatingNodes.size;
      const percent = (done / total) * 100;

      document.getElementById('generation-progress-fill').style.width = percent + '%';
      document.getElementById('generation-progress-text').textContent = \`\${done} / \${total} files\`;
    }

    function hideGenerationOverlay(result) {
      setTimeout(() => {
        document.getElementById('generation-overlay').classList.remove('show');

        if (result.success) {
          addChatMessage({
            role: 'assistant',
            content: \`Generated \${result.files.length} files successfully! Check your project folder.\`,
            timestamp: Date.now()
          });
        } else {
          addChatMessage({
            role: 'assistant',
            content: \`Generated \${result.files.length} files with \${result.errors.length} errors. Check the output for details.\`,
            timestamp: Date.now()
          });
        }
      }, 1000);
    }

    // Mode
    function setMode(newMode) {
      mode = newMode;
      document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('mode-' + newMode)?.classList.add('active');
    }

    // Canvas click to add node
    document.getElementById('canvas-container').addEventListener('dblclick', e => {
      if (e.target.id === 'canvas' || e.target.id === 'canvas-container') {
        showAddNodeMenu();
      }
    });
  </script>
</body>
</html>`;
  }
}
