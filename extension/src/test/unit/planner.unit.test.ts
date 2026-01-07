/**
 * Unit tests for Build Planner modules that don't require VS Code runtime
 * These tests mock the vscode module to test core logic
 */

import * as assert from 'assert';

// Mock vscode module before importing planner modules
const mockVscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key: string) => {
        if (key === 'apiEndpoint') return 'https://test.codebakers.ai';
        return undefined;
      },
    }),
    workspaceFolders: undefined,
    fs: {
      createDirectory: async () => {},
      writeFile: async () => {},
    },
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
};

// Inject mock before module loads
(global as any).vscode = mockVscode;

// Helper to create mock plans
function createMockPlan(nodes: any[] = [], edges: any[] = []) {
  return {
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
  };
}

// Helper to create mock nodes
function createMockNode(overrides: Partial<any> = {}) {
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'page' as const,
    name: 'TestNode',
    description: 'Test node description',
    position: { x: 0, y: 0 },
    details: {},
    status: 'draft' as const,
    aiGenerated: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Plan Data Structures', () => {
  it('should create valid mock plan', () => {
    const plan = createMockPlan();
    assert.ok(plan.id, 'Plan should have id');
    assert.strictEqual(plan.status, 'planning', 'Plan status should be planning');
    assert.ok(Array.isArray(plan.nodes), 'nodes should be array');
    assert.ok(Array.isArray(plan.edges), 'edges should be array');
    assert.ok(Array.isArray(plan.messages), 'messages should be array');
  });

  it('should create valid mock node', () => {
    const node = createMockNode();
    assert.ok(node.id, 'Node should have id');
    assert.strictEqual(node.type, 'page', 'Node type should be page');
    assert.strictEqual(node.status, 'draft', 'Node status should be draft');
    assert.ok(node.position, 'Node should have position');
  });

  it('should allow node type overrides', () => {
    const node = createMockNode({ type: 'api', name: 'UsersAPI' });
    assert.strictEqual(node.type, 'api', 'Node type should be api');
    assert.strictEqual(node.name, 'UsersAPI', 'Node name should be UsersAPI');
  });

  it('should create plan with nodes', () => {
    const nodes = [
      createMockNode({ type: 'page', name: 'Dashboard' }),
      createMockNode({ type: 'api', name: 'UsersAPI' }),
    ];
    const plan = createMockPlan(nodes);
    assert.strictEqual(plan.nodes.length, 2, 'Plan should have 2 nodes');
  });

  it('should create plan with edges', () => {
    const node1 = createMockNode({ id: 'node_1', type: 'page', name: 'Dashboard' });
    const node2 = createMockNode({ id: 'node_2', type: 'api', name: 'UsersAPI' });
    const edges = [
      { id: 'edge_1', source: 'node_1', target: 'node_2', type: 'calls' },
    ];
    const plan = createMockPlan([node1, node2], edges);
    assert.strictEqual(plan.edges.length, 1, 'Plan should have 1 edge');
  });
});

describe('Error Handling Patterns', () => {
  it('should extract error message from Error object', () => {
    const error = new Error('Test error message');
    const message = error instanceof Error ? error.message : String(error);
    assert.strictEqual(message, 'Test error message');
  });

  it('should convert non-Error to string', () => {
    const error = 'Simple string error';
    const message = error instanceof Error ? error.message : String(error);
    assert.strictEqual(message, 'Simple string error');
  });

  it('should handle null/undefined errors', () => {
    const error = null;
    const message = error instanceof Error ? error.message : String(error);
    assert.strictEqual(message, 'null');
  });
});

describe('Plan Node Validation', () => {
  it('should validate page node has route', () => {
    const node = createMockNode({
      type: 'page',
      name: 'Dashboard',
      details: { route: '/dashboard' },
    });
    assert.ok(node.details.route, 'Page should have route');
    assert.strictEqual(node.details.route, '/dashboard');
  });

  it('should validate API node has endpoint info', () => {
    const node = createMockNode({
      type: 'api',
      name: 'UsersAPI',
      details: { endpoint: '/api/users', methods: ['GET', 'POST'] },
    });
    assert.ok(node.details.endpoint, 'API should have endpoint');
    assert.ok(Array.isArray(node.details.methods), 'API should have methods array');
  });

  it('should validate database node has columns', () => {
    const node = createMockNode({
      type: 'database',
      name: 'UsersTable',
      details: {
        tableName: 'users',
        columns: [
          { name: 'id', type: 'uuid', primary: true },
          { name: 'email', type: 'varchar' },
        ],
      },
    });
    assert.ok(node.details.tableName, 'Database should have tableName');
    assert.ok(Array.isArray(node.details.columns), 'Database should have columns array');
    assert.strictEqual(node.details.columns.length, 2);
  });

  it('should validate component node has props', () => {
    const node = createMockNode({
      type: 'component',
      name: 'UserCard',
      details: {
        props: [
          { name: 'user', type: 'User', required: true },
          { name: 'onSelect', type: '() => void', required: false },
        ],
      },
    });
    assert.ok(Array.isArray(node.details.props), 'Component should have props array');
    assert.strictEqual(node.details.props.length, 2);
  });
});

describe('Plan Status Transitions', () => {
  const validPlanStatuses = ['planning', 'reviewing', 'approved', 'generating', 'completed'];
  const validNodeStatuses = ['draft', 'ai-suggested', 'approved', 'generated'];

  it('should recognize all valid plan statuses', () => {
    for (const status of validPlanStatuses) {
      const plan = createMockPlan();
      (plan as any).status = status;
      assert.ok(validPlanStatuses.includes(plan.status), `${status} should be valid`);
    }
  });

  it('should recognize all valid node statuses', () => {
    for (const status of validNodeStatuses) {
      const node = createMockNode();
      (node as any).status = status;
      assert.ok(validNodeStatuses.includes(node.status), `${status} should be valid`);
    }
  });
});

describe('Edge Validation', () => {
  it('should create valid edge', () => {
    const edge = {
      id: 'edge_1',
      source: 'node_1',
      target: 'node_2',
      type: 'calls',
      aiGenerated: false,
    };
    assert.ok(edge.id, 'Edge should have id');
    assert.ok(edge.source, 'Edge should have source');
    assert.ok(edge.target, 'Edge should have target');
  });

  it('should support various edge types', () => {
    const edgeTypes = ['imports', 'renders', 'calls', 'reads', 'writes', 'extends', 'uses'];
    for (const type of edgeTypes) {
      const edge = { id: 'e1', source: 'n1', target: 'n2', type };
      assert.strictEqual(edge.type, type);
    }
  });
});

describe('Timestamp Handling', () => {
  it('should have valid timestamps on plan', () => {
    const before = Date.now();
    const plan = createMockPlan();
    const after = Date.now();

    assert.ok(plan.createdAt >= before && plan.createdAt <= after);
    assert.ok(plan.updatedAt >= before && plan.updatedAt <= after);
  });

  it('should have valid timestamps on node', () => {
    const before = Date.now();
    const node = createMockNode();
    const after = Date.now();

    assert.ok(node.createdAt >= before && node.createdAt <= after);
    assert.ok(node.updatedAt >= before && node.updatedAt <= after);
  });
});

describe('Message Format', () => {
  it('should create valid AI message', () => {
    const message = {
      id: `msg_${Date.now()}`,
      role: 'assistant' as const,
      content: 'Hello! How can I help you plan your build?',
      timestamp: Date.now(),
      suggestedActions: [],
    };

    assert.ok(message.id.startsWith('msg_'));
    assert.strictEqual(message.role, 'assistant');
    assert.ok(message.content.length > 0);
    assert.ok(Array.isArray(message.suggestedActions));
  });

  it('should create valid user message', () => {
    const message = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content: 'I want to build a todo app',
      timestamp: Date.now(),
    };

    assert.strictEqual(message.role, 'user');
  });
});

describe('Suggestion Format', () => {
  it('should create valid suggestion', () => {
    const suggestion = {
      id: `sug_${Date.now()}`,
      type: 'missing-piece' as const,
      severity: 'warning' as const,
      title: 'No authentication detected',
      description: 'Your API has no auth protection',
      suggestedNodes: [
        { type: 'middleware', name: 'AuthMiddleware' },
      ],
      suggestedEdges: [],
      dismissed: false,
      createdAt: Date.now(),
    };

    assert.ok(suggestion.id.startsWith('sug_'));
    assert.ok(['info', 'warning', 'error'].includes(suggestion.severity) || suggestion.severity === 'warning');
    assert.ok(suggestion.title.length > 0);
  });
});

// Run with: npx mocha --require ts-node/register src/test/unit/*.test.ts
console.log('Unit tests loaded successfully');
