/**
 * AI Planner - Interactive AI that collaborates with users on architecture planning
 *
 * This is NOT a passive assistant. The AI:
 * - Proactively asks questions about the user's goals
 * - Suggests architecture patterns based on what's been added
 * - Warns about missing pieces (e.g., "You have an API but no error handling")
 * - Fills in details automatically (props, routes, schemas)
 */

import * as vscode from 'vscode';
import {
  Plan,
  PlanNode,
  PlanEdge,
  AIMessage,
  AISuggestion,
  AISuggestedAction,
  PlanNodeType,
  EdgeType,
  NODE_DEFAULTS,
  AIPlannerConfig,
} from './types';

// ============================================================================
// AI Planner Class
// ============================================================================

export class AIPlanner {
  private config: AIPlannerConfig;
  private apiEndpoint: string;
  private conversationContext: string[] = [];

  constructor(config: Partial<AIPlannerConfig> = {}) {
    console.log('AIPlanner: Initializing...');

    try {
      this.config = {
        proactivityLevel: 'balanced',
        autoSuggestConnections: true,
        warnMissingPatterns: true,
        projectType: 'nextjs',
        patterns: [],
        ...config,
      };

      const vsConfig = vscode.workspace.getConfiguration('codebakers');
      this.apiEndpoint = vsConfig.get('apiEndpoint') || 'https://www.codebakers.ai';

      console.log('AIPlanner: Initialized with endpoint:', this.apiEndpoint);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AIPlanner: Initialization failed:', errorMessage);
      // Set defaults in case of error
      this.config = {
        proactivityLevel: 'balanced',
        autoSuggestConnections: true,
        warnMissingPatterns: true,
        projectType: 'nextjs',
        patterns: [],
      };
      this.apiEndpoint = 'https://www.codebakers.ai';
    }
  }

  // ==========================================================================
  // Main Chat Handler
  // ==========================================================================

  async chat(userMessage: string, plan: Plan): Promise<AIMessage> {
    console.log('AIPlanner: Processing chat message, length:', userMessage.length);
    const messageId = `msg_${Date.now()}`;

    try {
      // Build context from current plan state
      console.log('AIPlanner: Building plan context...');
      const context = this.buildPlanContext(plan);

      // Determine what kind of response is needed
      const intent = this.detectIntent(userMessage, plan);
      console.log('AIPlanner: Detected intent:', intent);

      let response: string;
      let suggestedActions: AISuggestedAction[] = [];

      try {
        // Call AI to generate response
        console.log('AIPlanner: Calling AI API...');
        const aiResponse = await this.callAI(userMessage, context, intent, plan);
        response = aiResponse.message;
        suggestedActions = aiResponse.actions;
        console.log('AIPlanner: AI response received, actions:', suggestedActions.length);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('AIPlanner: Error calling AI:', errorMessage);
        console.log('AIPlanner: Using fallback response');
        response = this.generateFallbackResponse(userMessage, plan, intent);
        suggestedActions = this.generateFallbackActions(intent, plan);
      }

      const message: AIMessage = {
        id: messageId,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        suggestedActions,
      };

      // Update conversation context for future messages
      this.conversationContext.push(`User: ${userMessage}`);
      this.conversationContext.push(`Assistant: ${response}`);

      // Keep context manageable
      if (this.conversationContext.length > 20) {
        console.log('AIPlanner: Trimming conversation context');
        this.conversationContext = this.conversationContext.slice(-20);
      }

      console.log('AIPlanner: Chat completed successfully');
      return message;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AIPlanner: Chat processing failed:', errorMessage);
      console.error('AIPlanner: Stack:', error instanceof Error ? error.stack : 'No stack');

      // Return a safe error message
      return {
        id: messageId,
        role: 'assistant',
        content: "I'm having trouble processing that right now. Could you try rephrasing your request?",
        timestamp: Date.now(),
        suggestedActions: [],
      };
    }
  }

  // ==========================================================================
  // Initial Greeting - AI starts the conversation
  // ==========================================================================

  async getInitialGreeting(plan: Plan): Promise<AIMessage> {
    console.log('AIPlanner: Generating initial greeting, plan nodes:', plan.nodes.length);
    const messageId = `msg_${Date.now()}`;

    try {
      let content: string;
      let suggestedActions: AISuggestedAction[] = [];

      if (plan.nodes.length === 0) {
        // Empty plan - ask about their project
        console.log('AIPlanner: Empty plan, showing welcome message');
        content = `Hey! I'm here to help you plan your build. Let's figure out what you're making together.

**What are you building?** Give me the quick pitch - what's this app supposed to do?

Or if you want to get started faster, pick a template:`;

        suggestedActions = [
          {
            id: 'tpl_saas',
            type: 'use-template',
            label: 'SaaS Starter',
            description: 'Auth, billing, dashboard, settings',
            payload: { templateId: 'saas-starter' },
            status: 'pending',
          },
          {
            id: 'tpl_ecom',
            type: 'use-template',
            label: 'E-commerce',
            description: 'Products, cart, checkout, orders',
            payload: { templateId: 'ecommerce' },
            status: 'pending',
          },
          {
            id: 'tpl_dash',
            type: 'use-template',
            label: 'Admin Dashboard',
            description: 'Data tables, charts, CRUD',
            payload: { templateId: 'dashboard' },
            status: 'pending',
          },
        ];
      } else {
        // Resuming existing plan
        console.log('AIPlanner: Resuming existing plan');
        const nodeTypes = [...new Set(plan.nodes.map((n) => n.type))];
        content = `Welcome back! You've got ${plan.nodes.length} pieces planned: ${nodeTypes.join(', ')}.

What do you want to work on next?`;

        // Analyze and suggest what's missing
        const suggestions = this.analyzePlanCompleteness(plan);
        console.log('AIPlanner: Found', suggestions.length, 'improvement suggestions');
        if (suggestions.length > 0) {
          content += `\n\n**I noticed some things you might want to add:**`;
          suggestions.slice(0, 3).forEach((s) => {
            content += `\n- ${s.title}`;
          });
        }
      }

      console.log('AIPlanner: Initial greeting generated');
      return {
        id: messageId,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        suggestedActions,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AIPlanner: Failed to generate greeting:', errorMessage);

      // Return a safe fallback greeting
      return {
        id: messageId,
        role: 'assistant',
        content: "Hey! I'm here to help you plan your build. What are you building?",
        timestamp: Date.now(),
        suggestedActions: [],
      };
    }
  }

  // ==========================================================================
  // Proactive Suggestions - AI notices things and speaks up
  // ==========================================================================

  analyzeAndSuggest(plan: Plan): AISuggestion[] {
    console.log('AIPlanner: Analyzing plan for suggestions...');
    const suggestions: AISuggestion[] = [];

    try {
      // Check for common missing patterns
      const hasAuth = plan.nodes.some(
        (n) => n.name.toLowerCase().includes('auth') || n.name.toLowerCase().includes('login')
      );
      const hasApi = plan.nodes.some((n) => n.type === 'api');
      const hasDatabase = plan.nodes.some((n) => n.type === 'database');
      const hasPages = plan.nodes.some((n) => n.type === 'page');
      const hasErrorHandling = plan.nodes.some(
        (n) => n.name.toLowerCase().includes('error') || n.type === 'middleware'
      );

      console.log('AIPlanner: Plan analysis - hasAuth:', hasAuth, 'hasApi:', hasApi, 'hasDatabase:', hasDatabase);

    // API without auth
    if (hasApi && !hasAuth) {
      suggestions.push({
        id: `sug_${Date.now()}_auth`,
        type: 'missing-piece',
        severity: 'warning',
        title: 'No authentication detected',
        description:
          "You have API routes but no auth. Should I add login/signup pages and auth middleware?",
        suggestedNodes: [
          {
            type: 'page',
            name: 'LoginPage',
            description: 'User login page',
            details: { route: '/login', isProtected: false },
          },
          {
            type: 'page',
            name: 'SignupPage',
            description: 'User registration page',
            details: { route: '/signup', isProtected: false },
          },
          {
            type: 'middleware',
            name: 'authMiddleware',
            description: 'Protects routes requiring authentication',
          },
        ],
        dismissed: false,
        createdAt: Date.now(),
      });
    }

    // Database without types
    if (hasDatabase) {
      const dbNodes = plan.nodes.filter((n) => n.type === 'database');
      const typeNodes = plan.nodes.filter((n) => n.type === 'type');

      const dbWithoutTypes = dbNodes.filter(
        (db) => !typeNodes.some((t) => t.name.toLowerCase().includes(db.name.toLowerCase()))
      );

      if (dbWithoutTypes.length > 0) {
        suggestions.push({
          id: `sug_${Date.now()}_types`,
          type: 'improvement',
          severity: 'info',
          title: 'Missing TypeScript types for database models',
          description: `You have ${dbWithoutTypes.length} database table(s) without matching types. Want me to create types for ${dbWithoutTypes.map((d) => d.name).join(', ')}?`,
          suggestedNodes: dbWithoutTypes.map((db) => ({
            type: 'type' as PlanNodeType,
            name: `${db.name}Type`,
            description: `Type for ${db.name} table`,
            details: {
              fields: db.details.columns?.map((col) => ({
                name: col.name,
                type: this.sqlToTsType(col.type),
                required: col.required,
              })),
            },
          })),
          dismissed: false,
          createdAt: Date.now(),
        });
      }
    }

    // Pages without layout
    if (hasPages && plan.nodes.length >= 3) {
      const pageNodes = plan.nodes.filter((n) => n.type === 'page');
      const hasLayout = plan.nodes.some(
        (n) =>
          n.name.toLowerCase().includes('layout') || n.name.toLowerCase().includes('shell')
      );

      if (!hasLayout && pageNodes.length >= 2) {
        suggestions.push({
          id: `sug_${Date.now()}_layout`,
          type: 'improvement',
          severity: 'info',
          title: 'Consider adding a shared layout',
          description:
            "You have multiple pages but no shared layout. Want me to add a layout component with navigation?",
          suggestedNodes: [
            {
              type: 'component',
              name: 'AppLayout',
              description: 'Shared layout with navigation and footer',
              details: {
                props: [{ name: 'children', type: 'React.ReactNode', required: true }],
              },
            },
          ],
          dismissed: false,
          createdAt: Date.now(),
        });
      }
    }

    // API without error handling
    if (hasApi && !hasErrorHandling) {
      suggestions.push({
        id: `sug_${Date.now()}_errors`,
        type: 'warning',
        severity: 'warning',
        title: 'No error handling detected',
        description:
          'Your API routes need error handling. Should I add an error boundary and API error middleware?',
        suggestedNodes: [
          {
            type: 'middleware',
            name: 'errorHandler',
            description: 'Catches and formats API errors',
          },
          {
            type: 'component',
            name: 'ErrorBoundary',
            description: 'Catches React rendering errors',
          },
        ],
        dismissed: false,
        createdAt: Date.now(),
      });
    }

    // API that mutates data without validation
    const mutatingApis = plan.nodes.filter(
      (n) =>
        n.type === 'api' &&
        n.details.httpMethod &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(n.details.httpMethod)
    );

    if (mutatingApis.length > 0) {
      const hasValidation = plan.nodes.some(
        (n) =>
          n.type === 'service' &&
          (n.name.toLowerCase().includes('valid') || n.name.toLowerCase().includes('schema'))
      );

      if (!hasValidation) {
        suggestions.push({
          id: `sug_${Date.now()}_validation`,
          type: 'improvement',
          severity: 'info',
          title: 'Add input validation',
          description:
            'You have APIs that accept data. Consider adding Zod schemas for validation.',
          suggestedNodes: [
            {
              type: 'service',
              name: 'validationSchemas',
              description: 'Zod schemas for API input validation',
              details: {
                methods: mutatingApis.map((api) => ({
                  name: `${api.name}Schema`,
                  params: '',
                  returnType: 'z.ZodSchema',
                  isAsync: false,
                })),
              },
            },
          ],
          dismissed: false,
          createdAt: Date.now(),
        });
      }
    }

      console.log('AIPlanner: Generated', suggestions.length, 'suggestions');
      return suggestions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AIPlanner: Failed to analyze plan:', errorMessage);
      return [];
    }
  }

  // ==========================================================================
  // Auto-suggest connections when nodes are added
  // ==========================================================================

  suggestConnectionsForNode(newNode: PlanNode, existingNodes: PlanNode[]): PlanEdge[] {
    console.log('AIPlanner: Suggesting connections for node:', newNode.name, 'type:', newNode.type);

    try {
      if (!this.config.autoSuggestConnections) {
        console.log('AIPlanner: Auto-suggest connections disabled');
        return [];
      }

      const suggestedEdges: PlanEdge[] = [];

    switch (newNode.type) {
      case 'page':
        // Pages typically render components
        existingNodes
          .filter((n) => n.type === 'component')
          .forEach((component) => {
            // Only suggest if component name relates to page name
            if (this.areRelated(newNode.name, component.name)) {
              suggestedEdges.push({
                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                source: newNode.id,
                target: component.id,
                type: 'renders',
                aiGenerated: true,
                aiNotes: `${newNode.name} likely renders ${component.name}`,
              });
            }
          });

        // Pages might call APIs
        existingNodes
          .filter((n) => n.type === 'api')
          .forEach((api) => {
            if (this.areRelated(newNode.name, api.name)) {
              suggestedEdges.push({
                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                source: newNode.id,
                target: api.id,
                type: 'calls',
                aiGenerated: true,
                aiNotes: `${newNode.name} likely calls ${api.name}`,
              });
            }
          });
        break;

      case 'api':
        // APIs query/mutate databases
        existingNodes
          .filter((n) => n.type === 'database')
          .forEach((db) => {
            if (this.areRelated(newNode.name, db.name)) {
              const edgeType: EdgeType =
                newNode.details.httpMethod === 'GET' ? 'queries' : 'mutates';
              suggestedEdges.push({
                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                source: newNode.id,
                target: db.id,
                type: edgeType,
                aiGenerated: true,
                aiNotes: `${newNode.name} ${edgeType} ${db.name}`,
              });
            }
          });
        break;

      case 'component':
        // Components might use hooks
        existingNodes
          .filter((n) => n.type === 'hook')
          .forEach((hook) => {
            if (this.areRelated(newNode.name, hook.name)) {
              suggestedEdges.push({
                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                source: newNode.id,
                target: hook.id,
                type: 'uses',
                aiGenerated: true,
                aiNotes: `${newNode.name} might use ${hook.name}`,
              });
            }
          });
        break;

      case 'hook':
        // Hooks might call APIs or services
        existingNodes
          .filter((n) => n.type === 'api' || n.type === 'service')
          .forEach((target) => {
            if (this.areRelated(newNode.name, target.name)) {
              suggestedEdges.push({
                id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                source: newNode.id,
                target: target.id,
                type: 'calls',
                aiGenerated: true,
                aiNotes: `${newNode.name} might call ${target.name}`,
              });
            }
          });
        break;
    }

      console.log('AIPlanner: Suggested', suggestedEdges.length, 'connections');
      return suggestedEdges;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AIPlanner: Failed to suggest connections:', errorMessage);
      return [];
    }
  }

  // ==========================================================================
  // Node Detail Auto-Fill
  // ==========================================================================

  autoFillNodeDetails(node: PlanNode, plan: Plan): Partial<PlanNode['details']> {
    console.log('AIPlanner: Auto-filling details for node:', node.name, 'type:', node.type);

    try {
      const details: Partial<PlanNode['details']> = {};

      switch (node.type) {
      case 'page':
        // Generate route from name
        if (!node.details.route) {
          const route = this.nameToRoute(node.name);
          details.route = route;
        }
        // Check if page should be protected
        const hasAuth = plan.nodes.some(
          (n) =>
            n.name.toLowerCase().includes('auth') || n.name.toLowerCase().includes('login')
        );
        if (hasAuth && !node.name.toLowerCase().includes('login')) {
          details.isProtected = true;
        }
        break;

      case 'api':
        // Infer HTTP method from name
        if (!node.details.httpMethod) {
          const name = node.name.toLowerCase();
          if (name.includes('create') || name.includes('add') || name.includes('post')) {
            details.httpMethod = 'POST';
          } else if (name.includes('update') || name.includes('edit')) {
            details.httpMethod = 'PUT';
          } else if (name.includes('delete') || name.includes('remove')) {
            details.httpMethod = 'DELETE';
          } else {
            details.httpMethod = 'GET';
          }
        }
        break;

      case 'database':
        // Generate table name
        if (!node.details.tableName) {
          details.tableName = this.nameToTableName(node.name);
        }
        // Add common columns
        if (!node.details.columns || node.details.columns.length === 0) {
          details.columns = [
            { name: 'id', type: 'serial', required: true, description: 'Primary key' },
            { name: 'created_at', type: 'timestamp', required: true },
            { name: 'updated_at', type: 'timestamp', required: true },
          ];
        }
        break;

      case 'component':
        // If component name suggests it's for a specific entity, add props
        const relatedDb = plan.nodes.find(
          (n) => n.type === 'database' && this.areRelated(node.name, n.name)
        );
        if (relatedDb && (!node.details.props || node.details.props.length === 0)) {
          details.props = [
            {
              name: relatedDb.name.toLowerCase(),
              type: `${relatedDb.name}Type`,
              required: true,
            },
          ];
        }
        break;
    }

      console.log('AIPlanner: Auto-filled details:', Object.keys(details));
      return details;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('AIPlanner: Failed to auto-fill details:', errorMessage);
      return {};
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private buildPlanContext(plan: Plan): string {
    const lines: string[] = [
      `Project Type: ${this.config.projectType || 'nextjs'}`,
      `Total Nodes: ${plan.nodes.length}`,
      `Total Connections: ${plan.edges.length}`,
      '',
      'Current Architecture:',
    ];

    // Group nodes by type
    const nodesByType = new Map<PlanNodeType, PlanNode[]>();
    plan.nodes.forEach((node) => {
      const existing = nodesByType.get(node.type) || [];
      existing.push(node);
      nodesByType.set(node.type, existing);
    });

    nodesByType.forEach((nodes, type) => {
      lines.push(`\n${type.toUpperCase()}S:`);
      nodes.forEach((node) => {
        lines.push(`  - ${node.name}: ${node.description}`);
        if (node.type === 'api' && node.details.httpMethod) {
          lines.push(`    Method: ${node.details.httpMethod}`);
        }
        if (node.type === 'database' && node.details.columns) {
          lines.push(`    Columns: ${node.details.columns.map((c) => c.name).join(', ')}`);
        }
      });
    });

    // Add connections
    if (plan.edges.length > 0) {
      lines.push('\nConnections:');
      plan.edges.forEach((edge) => {
        const source = plan.nodes.find((n) => n.id === edge.source);
        const target = plan.nodes.find((n) => n.id === edge.target);
        if (source && target) {
          lines.push(`  - ${source.name} --[${edge.type}]--> ${target.name}`);
        }
      });
    }

    return lines.join('\n');
  }

  private detectIntent(
    message: string,
    plan: Plan
  ): 'describe' | 'add' | 'modify' | 'question' | 'generate' | 'review' {
    const lower = message.toLowerCase();

    if (lower.includes('generate') || lower.includes('build') || lower.includes("let's go")) {
      return 'generate';
    }
    if (lower.includes('review') || lower.includes('check') || lower.includes('ready')) {
      return 'review';
    }
    if (
      lower.includes('add') ||
      lower.includes('create') ||
      lower.includes('need') ||
      lower.includes('want')
    ) {
      return 'add';
    }
    if (lower.includes('change') || lower.includes('update') || lower.includes('modify')) {
      return 'modify';
    }
    if (lower.includes('?') || lower.includes('what') || lower.includes('how')) {
      return 'question';
    }

    return 'describe';
  }

  private async callAI(
    userMessage: string,
    context: string,
    intent: string,
    plan: Plan
  ): Promise<{ message: string; actions: AISuggestedAction[] }> {
    const systemPrompt = `You are an AI architect helping users design their application architecture. You're collaborative and proactive.

Your personality:
- You ASK questions to understand their goals
- You SUGGEST missing pieces they might need
- You WARN about potential issues
- You're friendly but efficient

Current plan context:
${context}

Recent conversation:
${this.conversationContext.slice(-6).join('\n')}

User's intent appears to be: ${intent}

Response format:
- Be concise (2-3 paragraphs max)
- If suggesting additions, describe them clearly
- Ask follow-up questions when needed
- Use markdown for formatting`;

    try {
      const response = await fetch(`${this.apiEndpoint}/api/ai/planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt,
          userMessage,
          plan: {
            nodes: plan.nodes.map((n) => ({ type: n.type, name: n.name })),
            edges: plan.edges.length,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { message: string; suggestedActions?: AISuggestedAction[] };
        return {
          message: data.message,
          actions: data.suggestedActions || [],
        };
      }
    } catch (error) {
      console.error('AIPlanner: API call failed:', error);
    }

    // Return fallback
    return {
      message: this.generateFallbackResponse(userMessage, plan, intent),
      actions: this.generateFallbackActions(intent, plan),
    };
  }

  private generateFallbackResponse(
    userMessage: string,
    plan: Plan,
    intent: string
  ): string {
    switch (intent) {
      case 'describe':
        return `Got it! Let me help you map that out.

Based on what you described, we might need:
- **Pages** for the main user flows
- **API routes** to handle data
- **Database tables** to store information

What's the most important feature to start with?`;

      case 'add':
        return `Sure, I can help add that!

Click anywhere on the canvas to add a node, or tell me more about what you need and I'll suggest the right components.

What type of piece is this - a page users see, an API endpoint, or something else?`;

      case 'generate':
        if (plan.nodes.length === 0) {
          return `Let's add some architecture first before generating code. What are you building?`;
        }
        const completeness = this.analyzePlanCompleteness(plan);
        if (completeness.length > 0) {
          return `Before we generate, I noticed a few things:\n\n${completeness.map((c) => `- ${c.title}`).join('\n')}\n\nWant me to add these, or should we proceed anyway?`;
        }
        return `Your plan looks good! Ready to generate ${plan.nodes.length} files. Click the Generate button to start.`;

      case 'review':
        return this.generateReviewResponse(plan);

      default:
        return `I'm here to help you plan! You can:
- Describe what you're building
- Add nodes to the canvas
- Ask me to suggest architecture

What would you like to do?`;
    }
  }

  private generateReviewResponse(plan: Plan): string {
    const issues = this.analyzePlanCompleteness(plan);
    const nodeCount = plan.nodes.length;
    const edgeCount = plan.edges.length;

    if (nodeCount === 0) {
      return "There's nothing to review yet. Start by telling me what you're building!";
    }

    let response = `**Plan Review**\n\n`;
    response += `📦 ${nodeCount} components planned\n`;
    response += `🔗 ${edgeCount} connections\n\n`;

    if (issues.length === 0) {
      response += `✅ Looking good! No obvious issues detected.\n\n`;
      response += `Ready to generate code?`;
    } else {
      response += `⚠️ Found ${issues.length} suggestion(s):\n\n`;
      issues.forEach((issue, i) => {
        response += `${i + 1}. **${issue.title}**\n   ${issue.description}\n\n`;
      });
      response += `Want me to add these, or proceed as-is?`;
    }

    return response;
  }

  private generateFallbackActions(
    intent: string,
    plan: Plan
  ): AISuggestedAction[] {
    const actions: AISuggestedAction[] = [];

    if (intent === 'add' || (plan.nodes.length === 0 && intent === 'describe')) {
      actions.push(
        {
          id: `act_page_${Date.now()}`,
          type: 'add-node',
          label: 'Add a Page',
          description: 'Add a new page to your app',
          payload: { nodeType: 'page' },
          status: 'pending',
        },
        {
          id: `act_api_${Date.now()}`,
          type: 'add-node',
          label: 'Add an API',
          description: 'Add an API endpoint',
          payload: { nodeType: 'api' },
          status: 'pending',
        },
        {
          id: `act_db_${Date.now()}`,
          type: 'add-node',
          label: 'Add a Table',
          description: 'Add a database table',
          payload: { nodeType: 'database' },
          status: 'pending',
        }
      );
    }

    if (intent === 'generate' && plan.nodes.length > 0) {
      actions.push({
        id: `act_gen_${Date.now()}`,
        type: 'generate',
        label: 'Generate All',
        description: `Generate ${plan.nodes.length} files`,
        payload: { dryRun: false },
        status: 'pending',
      });
    }

    return actions;
  }

  private analyzePlanCompleteness(plan: Plan): AISuggestion[] {
    return this.analyzeAndSuggest(plan).filter((s) => s.severity !== 'info');
  }

  private areRelated(name1: string, name2: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/page|component|api|table|type|hook|service/gi, '')
        .replace(/[^a-z]/g, '');

    const n1 = normalize(name1);
    const n2 = normalize(name2);

    return n1.includes(n2) || n2.includes(n1) || n1 === n2;
  }

  private nameToRoute(name: string): string {
    // Convert "UserProfilePage" to "/user-profile"
    return (
      '/' +
      name
        .replace(/Page$/, '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
    );
  }

  private nameToTableName(name: string): string {
    // Convert "UserProfile" to "user_profiles"
    return (
      name
        .replace(/Table$/, '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toLowerCase() + 's'
    );
  }

  private sqlToTsType(sqlType: string): string {
    const mapping: Record<string, string> = {
      serial: 'number',
      integer: 'number',
      int: 'number',
      bigint: 'number',
      text: 'string',
      varchar: 'string',
      boolean: 'boolean',
      timestamp: 'Date',
      date: 'Date',
      json: 'Record<string, unknown>',
      jsonb: 'Record<string, unknown>',
    };
    return mapping[sqlType.toLowerCase()] || 'unknown';
  }
}
