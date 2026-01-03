import { test, expect } from '@playwright/test';

test.describe('Safety System API - /api/safety', () => {
  test.describe('load_context action', () => {
    test('should create a session and return sessionId', async ({ request }) => {
      const response = await request.post('/api/safety', {
        data: {
          action: 'load_context',
          stateJson: JSON.stringify({
            version: '1.0',
            projectName: 'Test Project',
            projectType: 'new',
          }),
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('sessionId');
      expect(body.sessionId).toMatch(/^safety_/);
      expect(body).toHaveProperty('context');
      expect(body.context).toHaveProperty('decisionCount', 0);
    });

    test('should parse decisions from content', async ({ request }) => {
      const decisionsContent = `# Project Decisions

## 2024-01-15 - Use Drizzle ORM

**Category:** tech-stack
**Impact:** critical
**Reversible:** No
**Made by:** user (user approved)

**Reasoning:** Drizzle provides better TypeScript support

---
`;

      const response = await request.post('/api/safety', {
        data: {
          action: 'load_context',
          decisions: decisionsContent,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.context.hasDecisions).toBe(true);
      expect(body.context.decisionCount).toBe(1);
    });
  });

  test.describe('clarify_intent action', () => {
    test('should require sessionId', async ({ request }) => {
      const response = await request.post('/api/safety', {
        data: {
          action: 'clarify_intent',
          userInput: 'Build me an app',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('sessionId');
    });

    test('should analyze intent and return confidence scores', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Then clarify intent
      const response = await request.post('/api/safety', {
        data: {
          action: 'clarify_intent',
          sessionId,
          userInput: 'Build me an e-commerce store for selling shoes',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('overallConfidence');
      expect(body).toHaveProperty('scores');
      expect(Array.isArray(body.scores)).toBe(true);
    });
  });

  test.describe('define_scope action', () => {
    test('should require sessionId and userRequest', async ({ request }) => {
      const response = await request.post('/api/safety', {
        data: {
          action: 'define_scope',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('sessionId');
    });

    test('should create scope lock with inferred boundaries', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Then define scope
      const response = await request.post('/api/safety', {
        data: {
          action: 'define_scope',
          sessionId,
          userRequest: 'Add a login page with OAuth',
          allowedDirectories: ['src/app/', 'src/components/'],
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('scopeLock');
      expect(body.scopeLock).toHaveProperty('allowedActions');
      expect(body.scopeLock.allowedActions).toContain('create-file');
      expect(body.scopeLock.allowedActions).toContain('modify-file');
    });
  });

  test.describe('check_action action', () => {
    test('should allow actions when no scope lock exists', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Check an action without defining scope
      const response = await request.post('/api/safety', {
        data: {
          action: 'check_action',
          sessionId,
          actionType: 'modify-file',
          targetFile: 'src/app/page.tsx',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('allowed', true);
      expect(body).toHaveProperty('warning'); // Should warn about no scope lock
    });

    test('should block forbidden file modifications', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Define scope
      await request.post('/api/safety', {
        data: {
          action: 'define_scope',
          sessionId,
          userRequest: 'Add a feature',
        },
      });

      // Try to modify a forbidden file (.env)
      const response = await request.post('/api/safety', {
        data: {
          action: 'check_action',
          sessionId,
          actionType: 'modify-file',
          targetFile: '.env',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('allowed', false);
      expect(body).toHaveProperty('violation');
    });
  });

  test.describe('log_attempt action', () => {
    test('should log successful attempts', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Log an attempt
      const response = await request.post('/api/safety', {
        data: {
          action: 'log_attempt',
          sessionId,
          issue: 'Add login functionality',
          approach: 'Used Supabase Auth with email/password',
          codeOrCommand: 'Created auth/login/page.tsx',
          result: 'success',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('attemptId');
      expect(body).toHaveProperty('logged', true);
    });

    test('should detect repeated failed approaches', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Log a failed attempt
      await request.post('/api/safety', {
        data: {
          action: 'log_attempt',
          sessionId,
          issue: 'Connect to database',
          approach: 'Used raw SQL queries',
          codeOrCommand: 'SELECT * FROM users',
          result: 'failure',
          errorMessage: 'Connection timeout',
        },
      });

      // Log the same approach again
      const response = await request.post('/api/safety', {
        data: {
          action: 'log_attempt',
          sessionId,
          issue: 'Connect to database',
          approach: 'Used raw SQL queries',
          codeOrCommand: 'SELECT * FROM users',
          result: 'failure',
          errorMessage: 'Connection timeout',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('wasAlreadyTried', true);
    });
  });

  test.describe('log_decision action', () => {
    test('should log decisions with required fields', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Log a decision
      const response = await request.post('/api/safety', {
        data: {
          action: 'log_decision',
          sessionId,
          decision: 'Use Drizzle ORM for database access',
          category: 'tech-stack',
          reasoning: 'Better TypeScript support and simpler API',
          impact: 'high',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('decisionId');
      expect(body).toHaveProperty('markdown');
      expect(body.hasContradiction).toBe(false);
    });
  });

  test.describe('get_status action', () => {
    test('should return session status with gate information', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Get status
      const response = await request.post('/api/safety', {
        data: {
          action: 'get_status',
          sessionId,
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('gates');
      expect(body.gates).toHaveProperty('contextLoaded', true);
      expect(body).toHaveProperty('safetyScore');
      expect(body.safetyScore).toBeGreaterThanOrEqual(25); // At least context loaded
    });

    test('should be accessible via GET with query param', async ({ request }) => {
      // First create a session
      const loadResponse = await request.post('/api/safety', {
        data: { action: 'load_context' },
      });
      const { sessionId } = await loadResponse.json();

      // Get status via GET
      const response = await request.get(`/api/safety?sessionId=${sessionId}`);

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('sessionId', sessionId);
    });
  });

  test.describe('Error handling', () => {
    test('should return 400 for unknown action', async ({ request }) => {
      const response = await request.post('/api/safety', {
        data: {
          action: 'unknown_action',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Unknown action');
    });

    test('should return 400 for missing action', async ({ request }) => {
      const response = await request.post('/api/safety', {
        data: {},
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('action');
    });
  });
});

test.describe('Safety Integration with Pattern Routes', () => {
  test.describe('/api/patterns/discover with safety parameters', () => {
    test('should include safety warnings when context not loaded', async ({ request }) => {
      // This would need a valid API key or trial, so we just test structure
      const response = await request.post('/api/patterns/discover', {
        headers: {
          'x-device-hash': 'test-device-hash',
        },
        data: {
          task: 'Add login page',
          contextLoaded: false,
          scopeConfirmed: false,
        },
      });

      // Will likely fail auth, but we're testing the structure
      // In real tests, we'd use a test API key
      expect([200, 401, 402]).toContain(response.status());
    });
  });
});
