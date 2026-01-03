import { test, expect } from '@playwright/test';

test.describe('Engineering System API', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test.describe('User Engineering API', () => {
    test('GET /api/engineering/sessions returns 401 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/engineering/sessions`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/engineering/sessions with status filter returns 401 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/engineering/sessions?status=active`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/engineering/sessions with limit returns 401 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/engineering/sessions?limit=5`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Admin Engineering Sessions API', () => {
    test('GET /api/admin/engineering/sessions returns 401/403 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/admin/engineering/sessions`);
      expect([401, 403]).toContain(response.status());
    });

    test('GET /api/admin/engineering/sessions with filters returns 401/403 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/admin/engineering/sessions?status=active&phase=scoping`);
      expect([401, 403]).toContain(response.status());
    });

    test('GET /api/admin/engineering/sessions with pagination returns 401/403 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/admin/engineering/sessions?page=1&limit=10`);
      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Admin Engineering Stats API', () => {
    test('GET /api/admin/engineering/stats returns 401/403 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/admin/engineering/stats`);
      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Admin Session Actions API', () => {
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';

    test('POST /api/admin/engineering/sessions/:id/pause returns 401/403 without auth', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/admin/engineering/sessions/${fakeSessionId}/pause`);
      expect([401, 403]).toContain(response.status());
    });

    test('POST /api/admin/engineering/sessions/:id/resume returns 401/403 without auth', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/admin/engineering/sessions/${fakeSessionId}/resume`);
      expect([401, 403]).toContain(response.status());
    });

    test('POST /api/admin/engineering/sessions/:id/cancel returns 401/403 without auth', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/admin/engineering/sessions/${fakeSessionId}/cancel`);
      expect([401, 403]).toContain(response.status());
    });

    test('POST /api/admin/engineering/sessions/:id/cancel with reason returns 401/403 without auth', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/admin/engineering/sessions/${fakeSessionId}/cancel`, {
        data: { reason: 'Test cancellation' },
      });
      expect([401, 403]).toContain(response.status());
    });
  });
});
