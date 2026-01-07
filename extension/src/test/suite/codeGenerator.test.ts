import * as assert from 'assert';
import * as vscode from 'vscode';

suite('CodeGenerator Test Suite', () => {
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

  test('CodeGenerator should initialize without errors', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');

    let error: Error | null = null;
    let generator: any = null;

    try {
      generator = new CodeGenerator();
    } catch (e) {
      error = e as Error;
    }

    assert.strictEqual(error, null, 'CodeGenerator should initialize without throwing');
    assert.ok(generator, 'CodeGenerator instance should be created');
  });

  test('CodeGenerator should handle empty plan gracefully', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([]);
    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.ok(result, 'Should return a result');
    assert.strictEqual(result.success, true, 'Empty plan should succeed');
    assert.strictEqual(result.files.length, 0, 'No files should be generated');
    assert.strictEqual(result.errors.length, 0, 'No errors should occur');
  });

  test('CodeGenerator should generate page code in dry run', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_page_1',
        type: 'page',
        name: 'Dashboard',
        description: 'Main dashboard page',
        position: { x: 0, y: 0 },
        details: {
          route: '/dashboard',
          protected: true,
        },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.ok(result, 'Should return a result');
    assert.ok(result.files.length >= 1, 'Should generate at least one file');
    assert.ok(result.files[0].path.includes('dashboard'), 'File path should include page name');
    assert.ok(result.files[0].content.length > 0, 'Generated content should not be empty');
    assert.strictEqual(result.files[0].status, 'pending', 'Status should be pending in dry run');
  });

  test('CodeGenerator should generate component code', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_comp_1',
        type: 'component',
        name: 'UserCard',
        description: 'Displays user information',
        position: { x: 0, y: 0 },
        details: {
          props: [
            { name: 'user', type: 'User', required: true },
            { name: 'showActions', type: 'boolean', required: false },
          ],
        },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.ok(result.files.length >= 1, 'Should generate component file');
    const componentFile = result.files[0];
    assert.ok(componentFile.path.includes('UserCard'), 'Path should include component name');
    assert.ok(componentFile.content.includes('interface') || componentFile.content.includes('Props'), 'Should include props interface');
  });

  test('CodeGenerator should generate API route code', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_api_1',
        type: 'api',
        name: 'UsersAPI',
        description: 'User management API',
        position: { x: 0, y: 0 },
        details: {
          endpoint: '/api/users',
          methods: ['GET', 'POST'],
        },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.ok(result.files.length >= 1, 'Should generate API file');
    const apiFile = result.files[0];
    assert.ok(apiFile.path.includes('api'), 'Path should include api');
    assert.ok(
      apiFile.content.includes('GET') || apiFile.content.includes('POST'),
      'Should include HTTP methods'
    );
  });

  test('CodeGenerator should generate database schema code', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_db_1',
        type: 'database',
        name: 'UsersTable',
        description: 'Users database table',
        position: { x: 0, y: 0 },
        details: {
          tableName: 'users',
          columns: [
            { name: 'id', type: 'uuid', primary: true },
            { name: 'email', type: 'varchar', unique: true },
            { name: 'name', type: 'varchar' },
            { name: 'createdAt', type: 'timestamp' },
          ],
        },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.ok(result.files.length >= 1, 'Should generate database file');
    const dbFile = result.files[0];
    assert.ok(dbFile.content.includes('drizzle') || dbFile.content.includes('table'), 'Should include database code');
  });

  test('CodeGenerator should handle generation errors gracefully', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    // Create a plan with an unknown node type to test error handling
    const plan = createMockPlan([
      {
        id: 'node_unknown',
        type: 'unknown_type' as any,
        name: 'UnknownNode',
        description: 'This should cause an error',
        position: { x: 0, y: 0 },
        details: {},
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    // Should not throw, but record errors
    assert.ok(result, 'Should return a result even with errors');
    assert.ok(result.errors.length > 0, 'Should have recorded the error');
    assert.ok(result.errors[0].error.includes('Unknown'), 'Error should mention unknown type');
  });

  test('CodeGenerator should track progress during generation', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_1',
        type: 'page',
        name: 'Page1',
        description: 'Test page 1',
        position: { x: 0, y: 0 },
        details: { route: '/page1' },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'node_2',
        type: 'page',
        name: 'Page2',
        description: 'Test page 2',
        position: { x: 200, y: 0 },
        details: { route: '/page2' },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const progressCalls: { nodeId: string; status: string }[] = [];

    const result = await generator.generate(plan, request, (nodeId, status) => {
      progressCalls.push({ nodeId, status });
    });

    assert.ok(progressCalls.length >= 2, 'Should have progress calls');
    // Should have generating and done for each node
    const generatingCalls = progressCalls.filter(p => p.status === 'generating');
    const doneCalls = progressCalls.filter(p => p.status === 'done');
    assert.ok(generatingCalls.length >= 2, 'Should call generating for each node');
    assert.ok(doneCalls.length >= 2, 'Should call done for each node');
  });

  test('CodeGenerator should generate specific nodes when requested', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_1',
        type: 'page',
        name: 'Page1',
        description: 'Test page 1',
        position: { x: 0, y: 0 },
        details: { route: '/page1' },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'node_2',
        type: 'page',
        name: 'Page2',
        description: 'Test page 2',
        position: { x: 200, y: 0 },
        details: { route: '/page2' },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    // Only generate node_1
    const request = {
      planId: plan.id,
      nodes: ['node_1'],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.strictEqual(result.files.length, 1, 'Should only generate one file');
    assert.ok(result.files[0].path.includes('page1'), 'Should generate the specified node');
  });

  test('CodeGenerator should include duration in results', async () => {
    const { CodeGenerator } = await import('../../planner/CodeGenerator');
    const generator = new CodeGenerator();

    const plan = createMockPlan([
      {
        id: 'node_1',
        type: 'page',
        name: 'TestPage',
        description: 'Test page',
        position: { x: 0, y: 0 },
        details: { route: '/test' },
        status: 'draft',
        aiGenerated: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]);

    const request = {
      planId: plan.id,
      nodes: [],
      dryRun: true,
      usePatterns: false,
    };

    const result = await generator.generate(plan, request);

    assert.ok(typeof result.duration === 'number', 'Duration should be a number');
    assert.ok(result.duration >= 0, 'Duration should be non-negative');
  });
});
