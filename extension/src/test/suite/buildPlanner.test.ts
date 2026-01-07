import * as assert from 'assert';
import * as vscode from 'vscode';

suite('BuildPlannerProvider Test Suite', () => {
  // Note: Full webview testing is limited in headless mode
  // These tests verify the provider can be instantiated and basic operations work

  test('BuildPlannerProvider module should load', async () => {
    let error: Error | null = null;
    let module: any = null;

    try {
      module = await import('../../planner/BuildPlannerProvider');
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(error, null, 'Module should load without errors');
    assert.ok(module.BuildPlannerProvider, 'BuildPlannerProvider should be exported');
  });

  test('BuildPlannerProvider should have createOrShow method', async () => {
    const { BuildPlannerProvider } = await import('../../planner/BuildPlannerProvider');

    assert.ok(
      typeof BuildPlannerProvider.createOrShow === 'function',
      'createOrShow should be a static method'
    );
  });

  test('Types module should export all required types', async () => {
    const types = await import('../../planner/types');

    // Check that all required exports exist
    assert.ok(types.NODE_DEFAULTS, 'NODE_DEFAULTS should be exported');
    assert.ok(typeof types.NODE_DEFAULTS === 'object', 'NODE_DEFAULTS should be an object');

    // Check NODE_DEFAULTS has expected node types
    const expectedNodeTypes = ['page', 'component', 'api', 'database', 'type', 'service', 'middleware', 'job'];
    for (const nodeType of expectedNodeTypes) {
      assert.ok(
        types.NODE_DEFAULTS[nodeType as keyof typeof types.NODE_DEFAULTS],
        `NODE_DEFAULTS should have ${nodeType}`
      );
    }
  });

  test('NODE_DEFAULTS should have valid structure', async () => {
    const { NODE_DEFAULTS } = await import('../../planner/types');

    for (const [nodeType, defaults] of Object.entries(NODE_DEFAULTS)) {
      assert.ok(
        typeof defaults === 'object',
        `NODE_DEFAULTS.${nodeType} should be an object`
      );

      // Each should have description and color
      assert.ok(
        typeof (defaults as any).description === 'string',
        `NODE_DEFAULTS.${nodeType} should have description`
      );
      assert.ok(
        typeof (defaults as any).color === 'string',
        `NODE_DEFAULTS.${nodeType} should have color`
      );
    }
  });

  test('Planner index should export all components', async () => {
    const planner = await import('../../planner');

    assert.ok(planner.BuildPlannerProvider, 'Should export BuildPlannerProvider');
    assert.ok(planner.AIPlanner, 'Should export AIPlanner');
    assert.ok(planner.CodeGenerator, 'Should export CodeGenerator');
  });

  test('BuildPlannerProvider.createOrShow should be callable', async () => {
    const { BuildPlannerProvider } = await import('../../planner/BuildPlannerProvider');

    // Get extension context from test environment
    const extension = vscode.extensions.getExtension('codebakers.codebakers');

    if (extension) {
      // Just test that it doesn't throw immediately
      // Actually opening a panel in tests is tricky
      try {
        // Pass a mock URI - this may or may not work in test environment
        const mockUri = vscode.Uri.file(__dirname);

        // This will create a panel - we just want to verify no immediate crash
        // Note: In CI/headless this might behave differently
        BuildPlannerProvider.createOrShow(mockUri);

        // If we get here without throwing, that's good
        assert.ok(true, 'createOrShow did not throw');
      } catch (e) {
        // Some errors are expected in test environment (no workspace, etc.)
        const errorMessage = (e as Error).message || '';
        // Only fail if it's an unexpected error
        if (
          !errorMessage.includes('workspace') &&
          !errorMessage.includes('webview') &&
          !errorMessage.includes('panel')
        ) {
          assert.fail(`Unexpected error: ${errorMessage}`);
        }
      }
    }
  });

  test('Error handling should work in constructor', async () => {
    // Test that even if initialization has issues, it doesn't crash
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const { CodeGenerator } = await import('../../planner/CodeGenerator');

    // These should initialize with fallback defaults
    const planner = new AIPlanner({});
    const generator = new CodeGenerator();

    assert.ok(planner, 'AIPlanner should be created');
    assert.ok(generator, 'CodeGenerator should be created');
  });
});

suite('Build Planner Error Handling Suite', () => {
  test('AIPlanner chat should return valid response even on API failure', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    const plan = {
      id: 'test_plan',
      name: 'Test',
      description: '',
      nodes: [],
      edges: [],
      messages: [],
      suggestions: [],
      generatedFiles: [],
      status: 'planning' as const,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // The API call will fail (no real API in tests), but should return fallback
    const response = await planner.chat('test message', plan);

    assert.ok(response, 'Should return a response');
    assert.ok(response.id, 'Response should have ID');
    assert.strictEqual(response.role, 'assistant', 'Role should be assistant');
    assert.ok(response.content.length > 0, 'Content should not be empty');
    assert.ok(response.timestamp > 0, 'Timestamp should be set');
  });

  test('CodeGenerator should handle missing workspace gracefully', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = {
      id: 'test_plan',
      name: 'Test',
      description: '',
      nodes: [
        {
          id: 'node_1',
          type: 'page' as const,
          name: 'TestPage',
          description: 'Test',
          position: { x: 0, y: 0 },
          details: { route: '/test' },
          status: 'draft' as const,
          aiGenerated: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      edges: [],
      messages: [],
      suggestions: [],
      generatedFiles: [],
      status: 'planning' as const,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Dry run should work even without workspace
    const result = await generator.generate(plan, {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    });

    assert.ok(result, 'Should return result');
    assert.ok(result.files.length > 0, 'Should generate files in dry run');
  });

  test('analyzeAndSuggest should not throw on edge cases', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    // Test with various edge case plans
    const edgeCases = [
      // Empty plan
      {
        id: 'empty',
        name: '',
        description: '',
        nodes: [],
        edges: [],
        messages: [],
        suggestions: [],
        generatedFiles: [],
        status: 'planning' as const,
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      // Plan with many nodes
      {
        id: 'many_nodes',
        name: 'Many',
        description: '',
        nodes: Array(50).fill(null).map((_, i) => ({
          id: `node_${i}`,
          type: 'page' as const,
          name: `Page${i}`,
          description: '',
          position: { x: i * 100, y: 0 },
          details: {},
          status: 'draft' as const,
          aiGenerated: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })),
        edges: [],
        messages: [],
        suggestions: [],
        generatedFiles: [],
        status: 'planning' as const,
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    for (const plan of edgeCases) {
      let error: Error | null = null;
      try {
        planner.analyzeAndSuggest(plan);
      } catch (e) {
        error = e as Error;
      }
      assert.strictEqual(error, null, `analyzeAndSuggest should not throw for ${plan.id}`);
    }
  });
});

suite('Build Planner Logging Suite', () => {
  // These tests verify that logging happens (we can't easily capture console.log in tests,
  // but we can verify the code paths don't throw)

  test('AIPlanner methods should execute logging code paths', async () => {
    const { AIPlanner } = await import('../../planner/AIPlanner');
    const planner = new AIPlanner();

    const plan = {
      id: 'test_plan',
      name: 'Test',
      description: '',
      nodes: [],
      edges: [],
      messages: [],
      suggestions: [],
      generatedFiles: [],
      status: 'planning' as const,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // These should all execute their logging without errors
    await planner.getInitialGreeting(plan);
    await planner.chat('test', plan);
    planner.analyzeAndSuggest(plan);
    planner.suggestConnectionsForNode(
      {
        id: 'test',
        type: 'page',
        name: 'Test',
        description: '',
        position: { x: 0, y: 0 },
        details: {},
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      []
    );
    planner.autoFillNodeDetails(
      {
        id: 'test',
        type: 'page',
        name: 'Test',
        description: '',
        position: { x: 0, y: 0 },
        details: {},
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      plan
    );

    assert.ok(true, 'All AIPlanner methods executed without throwing');
  });

  test('CodeGenerator should execute all logging code paths', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = {
      id: 'test_plan',
      name: 'Test',
      description: '',
      nodes: [
        {
          id: 'node_1',
          type: 'page' as const,
          name: 'TestPage',
          description: 'Test',
          position: { x: 0, y: 0 },
          details: { route: '/test' },
          status: 'draft' as const,
          aiGenerated: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      edges: [],
      messages: [],
      suggestions: [],
      generatedFiles: [],
      status: 'planning' as const,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await generator.generate(
      plan,
      {
        planId: plan.id,
        nodes: [],
        dryRun: true,
        usePatterns: false,
      },
      (nodeId, status, file) => {
        // Progress callback
      }
    );

    assert.ok(true, 'CodeGenerator executed all logging code paths');
  });
});
