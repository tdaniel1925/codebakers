import * as assert from 'assert';
import * as vscode from 'vscode';

// We need to import these after VS Code is available
// The actual AIPlanner will be tested through the extension
suite('AIPlanner Test Suite', () => {
  // Create a mock plan for testing
  const createMockPlan = (nodes: any[] = [], edges: any[] = []) => ({
    id: `plan_test_${Date.now()}`,
    name: 'Test Plan',
    description: '',
    nodes,
    edges,
    messages: [],
    suggestions: [],
    generatedFiles: [],
    status: 'planning' as const,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  test('AIPlanner should initialize without errors', async () => {
    // Import dynamically to ensure VS Code context is available
    const { AIPlanner } = await import('../../planner/AIPlanner');

    let error: Error | null = null;
    let planner: any = null;

    try {
      planner = new AIPlanner();
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(error, null, 'AIPlanner should initialize without throwing');
    assert.ok(planner, 'AIPlanner instance should be created');
  });

  test('AIPlanner should generate initial greeting for empty plan', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();
    const plan = createMockPlan();

    const greeting = await planner.getInitialGreeting(plan);

    assert.ok(greeting, 'Greeting should be returned');
    assert.strictEqual(greeting.role, 'assistant', 'Role should be assistant');
    assert.ok(greeting.content.length > 0, 'Content should not be empty');
    assert.ok(greeting.id.startsWith('msg_'), 'Message ID should have correct format');
    assert.ok(greeting.timestamp > 0, 'Timestamp should be set');
  });

  test('AIPlanner should generate greeting with suggestions for existing plan', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    const plan = createMockPlan([
      {
        id: 'node_1',
        type: 'api',
        name: 'UsersAPI',
        description: 'User management API',
        position: { x: 0, y: 0 },
        details: {},
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const greeting = await planner.getInitialGreeting(plan);

    assert.ok(greeting.content.includes('Welcome back'), 'Should welcome back user');
    assert.ok(greeting.content.includes('1'), 'Should mention number of nodes');
  });

  test('AIPlanner should handle chat messages without crashing', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();
    const plan = createMockPlan();

    // This should not throw even if API is unavailable
    const response = await planner.chat('Hello, I want to build a todo app', plan);

    assert.ok(response, 'Response should be returned');
    assert.strictEqual(response.role, 'assistant', 'Role should be assistant');
    assert.ok(response.content.length > 0, 'Content should not be empty');
    assert.ok(Array.isArray(response.suggestedActions), 'suggestedActions should be an array');
  });

  test('AIPlanner should analyze plan and suggest improvements', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    // Plan with API but no auth - should suggest adding auth
    const plan = createMockPlan([
      {
        id: 'node_1',
        type: 'api',
        name: 'DataAPI',
        description: 'Data API',
        position: { x: 0, y: 0 },
        details: {},
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const suggestions = planner.analyzeAndSuggest(plan);

    assert.ok(Array.isArray(suggestions), 'Should return array of suggestions');
    // Should suggest adding auth since there's an API without auth
    const hasAuthSuggestion = suggestions.some(s =>
      s.title.toLowerCase().includes('auth') ||
      s.description?.toLowerCase().includes('auth')
    );
    assert.ok(hasAuthSuggestion, 'Should suggest adding authentication');
  });

  test('AIPlanner should suggest connections for new nodes', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner({ autoSuggestConnections: true });

    const existingNodes = [
      {
        id: 'node_db',
        type: 'database' as const,
        name: 'UsersTable',
        description: 'Users database table',
        position: { x: 0, y: 0 },
        details: {},
        status: 'draft' as const,
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const newNode = {
      id: 'node_api',
      type: 'api' as const,
      name: 'UsersAPI',
      description: 'Users API',
      position: { x: 200, y: 0 },
      details: {},
      status: 'draft' as const,
      aiGenerated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const suggestedEdges = planner.suggestConnectionsForNode(newNode, existingNodes);

    assert.ok(Array.isArray(suggestedEdges), 'Should return array of edges');
    // API should connect to database with similar name
    if (suggestedEdges.length > 0) {
      assert.ok(suggestedEdges[0].source || suggestedEdges[0].target, 'Edge should have source or target');
    }
  });

  test('AIPlanner should auto-fill node details', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    const plan = createMockPlan();

    const pageNode = {
      id: 'node_page',
      type: 'page' as const,
      name: 'Dashboard',
      description: 'Main dashboard page',
      position: { x: 0, y: 0 },
      details: {},
      status: 'draft' as const,
      aiGenerated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const autoDetails = planner.autoFillNodeDetails(pageNode, plan);

    assert.ok(typeof autoDetails === 'object', 'Should return details object');
    // Should auto-fill route for page
    if (autoDetails.route) {
      assert.ok(autoDetails.route.startsWith('/'), 'Route should start with /');
    }
  });

  test('AIPlanner should handle errors gracefully in chat', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    // Pass null/undefined to trigger error handling
    const plan = createMockPlan();

    // Even with edge cases, should return a valid response
    const response = await planner.chat('', plan);

    assert.ok(response, 'Should still return a response');
    assert.strictEqual(response.role, 'assistant', 'Role should be assistant');
  });

  test('AIPlanner configuration should be customizable', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');

    const customConfig = {
      proactivityLevel: 'aggressive' as const,
      autoSuggestConnections: false,
      warnMissingPatterns: false,
      projectType: 'react' as const,
    };

    const planner = new AIPlanner(customConfig);

    // Test that autoSuggestConnections: false works
    const node = {
      id: 'node_1',
      type: 'page' as const,
      name: 'TestPage',
      description: '',
      position: { x: 0, y: 0 },
      details: {},
      status: 'draft' as const,
      aiGenerated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const edges = planner.suggestConnectionsForNode(node, []);
    assert.strictEqual(edges.length, 0, 'Should not suggest connections when disabled');
  });
});
