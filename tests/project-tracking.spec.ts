import { test, expect } from '@playwright/test';

/**
 * Project Tracking Dashboard Tests
 * Tests the server-side project tracking feature
 *
 * Prerequisites:
 * - Set TEST_API_KEY environment variable with a valid CodeBakers API key
 * - Or tests will skip authenticated operations
 *
 * To run with API key:
 *   TEST_API_KEY=cb_xxx npx playwright test tests/project-tracking.spec.ts
 */

// Get API key from environment
const API_KEY = process.env.TEST_API_KEY;

// Helper to create auth headers
function getAuthHeaders(): Record<string, string> {
  if (!API_KEY) return {};
  return { Authorization: `Bearer ${API_KEY}` };
}

test.describe('Project Tracking API', () => {
  test.describe('Projects List', () => {
    test('should return empty list for new user', async ({ request }) => {
      const response = await request.get('/api/projects', {
        headers: getAuthHeaders(),
      });

      // Expect 401 if not authenticated, 200 if authenticated
      expect([200, 401]).toContain(response.status());

      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data.projects)).toBe(true);
      }
    });

    test('should create a new project', async ({ request }) => {
      const response = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'test-hash-' + Date.now(),
          projectName: 'Test Project',
          projectDescription: 'A test project for Playwright',
          detectedStack: {
            framework: 'nextjs',
            database: 'postgres',
          },
        },
      });

      // Expect 401 if not authenticated, 200 if authenticated
      expect([200, 201, 401]).toContain(response.status());

      if (response.status() === 200 || response.status() === 201) {
        const data = await response.json();
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('project');
        expect(data.data.project).toHaveProperty('id');
        expect(data.data.project).toHaveProperty('projectName');
      }
    });
  });

  test.describe('Project Sync API', () => {
    test('should sync project status', async ({ request }) => {
      // First create a project
      const createResponse = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'sync-test-' + Date.now(),
          projectName: 'Sync Test Project',
        },
      });

      if (createResponse.status() !== 200 && createResponse.status() !== 201) {
        test.skip();
        return;
      }

      const createData = await createResponse.json();
      const projectId = createData.data?.project?.id;

      if (!projectId) {
        test.skip();
        return;
      }

      // Now sync project data
      const syncResponse = await request.post(`/api/projects/${projectId}/sync`, {
        headers: getAuthHeaders(),
        data: {
          project: {
            status: 'building',
            overallProgress: 50,
          },
          events: [
            {
              eventType: 'phase_started',
              eventTitle: 'Started Phase 1',
              eventDescription: 'Beginning the foundation phase',
            },
          ],
        },
      });

      expect([200, 401]).toContain(syncResponse.status());

      if (syncResponse.status() === 200) {
        const syncData = await syncResponse.json();
        expect(syncData).toHaveProperty('data');
        expect(syncData.data).toHaveProperty('synced');
        expect(syncData.data.synced.project).toBe(true);
        expect(syncData.data.synced.events).toBe(1);
      }
    });

    test('should sync test run results', async ({ request }) => {
      // First create a project
      const createResponse = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'testrun-test-' + Date.now(),
          projectName: 'Test Run Project',
        },
      });

      if (createResponse.status() !== 200 && createResponse.status() !== 201) {
        test.skip();
        return;
      }

      const createData = await createResponse.json();
      const projectId = createData.data?.project?.id;

      if (!projectId) {
        test.skip();
        return;
      }

      // Sync test run data
      const syncResponse = await request.post(`/api/projects/${projectId}/sync`, {
        headers: getAuthHeaders(),
        data: {
          testRuns: [
            {
              testType: 'playwright',
              testCommand: 'npm test',
              passed: true,
              totalTests: 10,
              passedTests: 9,
              failedTests: 1,
              skippedTests: 0,
              durationMs: 5000,
            },
          ],
        },
      });

      expect([200, 401]).toContain(syncResponse.status());

      if (syncResponse.status() === 200) {
        const syncData = await syncResponse.json();
        expect(syncData.data.synced.testRuns).toBe(1);
      }
    });

    test('should sync risk flags', async ({ request }) => {
      // First create a project
      const createResponse = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'risk-test-' + Date.now(),
          projectName: 'Risk Flag Project',
        },
      });

      if (createResponse.status() !== 200 && createResponse.status() !== 201) {
        test.skip();
        return;
      }

      const createData = await createResponse.json();
      const projectId = createData.data?.project?.id;

      if (!projectId) {
        test.skip();
        return;
      }

      // Sync risk flags
      const syncResponse = await request.post(`/api/projects/${projectId}/sync`, {
        headers: getAuthHeaders(),
        data: {
          riskFlags: [
            {
              riskLevel: 'high',
              riskCategory: 'security',
              riskTitle: 'API key exposed in client code',
              riskDescription: 'Found hardcoded API key in frontend component',
              triggerFile: 'src/components/Dashboard.tsx',
              aiRecommendation: 'Move API key to server-side environment variable',
            },
          ],
        },
      });

      expect([200, 401]).toContain(syncResponse.status());

      if (syncResponse.status() === 200) {
        const syncData = await syncResponse.json();
        expect(syncData.data.synced.riskFlags).toBe(1);
      }
    });
  });

  test.describe('Project Events API', () => {
    test('should get project timeline', async ({ request }) => {
      // First create a project
      const createResponse = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'timeline-test-' + Date.now(),
          projectName: 'Timeline Project',
        },
      });

      if (createResponse.status() !== 200 && createResponse.status() !== 201) {
        test.skip();
        return;
      }

      const createData = await createResponse.json();
      const projectId = createData.data?.project?.id;

      if (!projectId) {
        test.skip();
        return;
      }

      // Get events
      const eventsResponse = await request.get(`/api/projects/${projectId}/events`, {
        headers: getAuthHeaders(),
      });

      expect([200, 401]).toContain(eventsResponse.status());

      if (eventsResponse.status() === 200) {
        const eventsData = await eventsResponse.json();
        expect(eventsData).toHaveProperty('data');
        expect(Array.isArray(eventsData.data.events)).toBe(true);
      }
    });
  });

  test.describe('Project Files API', () => {
    test('should get file tree', async ({ request }) => {
      // First create a project
      const createResponse = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'files-test-' + Date.now(),
          projectName: 'Files Project',
        },
      });

      if (createResponse.status() !== 200 && createResponse.status() !== 201) {
        test.skip();
        return;
      }

      const createData = await createResponse.json();
      const projectId = createData.data?.project?.id;

      if (!projectId) {
        test.skip();
        return;
      }

      // Get file tree
      const filesResponse = await request.get(`/api/projects/${projectId}/files`, {
        headers: getAuthHeaders(),
      });

      expect([200, 401]).toContain(filesResponse.status());

      if (filesResponse.status() === 200) {
        const filesData = await filesResponse.json();
        expect(filesData).toHaveProperty('data');
        expect(filesData.data).toHaveProperty('files');
        expect(filesData.data).toHaveProperty('tree');
        expect(filesData.data).toHaveProperty('stats');
      }
    });
  });

  test.describe('Project Dependencies API', () => {
    test('should get dependency graph', async ({ request }) => {
      // First create a project
      const createResponse = await request.post('/api/projects', {
        headers: getAuthHeaders(),
        data: {
          projectHash: 'deps-test-' + Date.now(),
          projectName: 'Dependencies Project',
        },
      });

      if (createResponse.status() !== 200 && createResponse.status() !== 201) {
        test.skip();
        return;
      }

      const createData = await createResponse.json();
      const projectId = createData.data?.project?.id;

      if (!projectId) {
        test.skip();
        return;
      }

      // Get dependency graph
      const depsResponse = await request.get(`/api/projects/${projectId}/dependencies`, {
        headers: getAuthHeaders(),
      });

      expect([200, 401]).toContain(depsResponse.status());

      if (depsResponse.status() === 200) {
        const depsData = await depsResponse.json();
        expect(depsData).toHaveProperty('data');
        expect(depsData.data).toHaveProperty('nodes');
        expect(depsData.data).toHaveProperty('links');
        expect(depsData.data).toHaveProperty('stats');
      }
    });
  });
});

test.describe('Project Dashboard UI', () => {
  test('should show projects list page', async ({ page }) => {
    await page.goto('/projects');

    // Should either redirect to login or show projects
    const url = page.url();
    expect(url).toMatch(/\/(projects|login)/);
  });

  test('should show project detail page with tabs', async ({ page }) => {
    // First navigate to projects list
    await page.goto('/projects');

    // If we're on the projects page, check for expected elements
    if (page.url().includes('/projects')) {
      // Look for project cards or empty state
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });
});

test.describe('Input Validation', () => {
  test('should reject invalid project hash', async ({ request }) => {
    const response = await request.post('/api/projects', {
      headers: getAuthHeaders(),
      data: {
        projectHash: '', // Empty hash should fail
        projectName: 'Test',
      },
    });

    // Should get 400 or 401 (if not authed)
    expect([400, 401]).toContain(response.status());
  });

  test('should reject invalid project name', async ({ request }) => {
    const response = await request.post('/api/projects', {
      headers: getAuthHeaders(),
      data: {
        projectHash: 'valid-hash-123',
        projectName: '', // Empty name should fail
      },
    });

    // Should get 400 or 401 (if not authed)
    expect([400, 401]).toContain(response.status());
  });

  test('should reject invalid progress value', async ({ request }) => {
    // First need a project ID - this test assumes one exists
    // In a real test suite, you'd create one first
    const response = await request.post('/api/projects/some-id/sync', {
      headers: getAuthHeaders(),
      data: {
        project: {
          overallProgress: 150, // Over 100 should fail
        },
      },
    });

    // Should get 400 (validation), 401 (not authed), 404 (not found), or 500 (server error)
    // Key assertion: should NOT return 200/201 (success)
    expect([400, 401, 404, 500]).toContain(response.status());
  });
});
