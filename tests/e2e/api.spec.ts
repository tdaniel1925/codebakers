import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test.describe('Health Check', () => {
    test('GET /api/health returns healthy status', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/health`);
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data).toHaveProperty('timestamp');
    });
  });

  test.describe('Content API', () => {
    test('GET /api/content returns 401 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/content`);
      expect(response.status()).toBe(401);
    });

    test('GET /api/content returns 401 with invalid key', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/content`, {
        headers: {
          Authorization: 'Bearer invalid_key',
        },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Keys API', () => {
    test('GET /api/keys returns 401 without auth', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/keys`);
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Billing API', () => {
    test('POST /api/billing/checkout returns 401 without auth', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/billing/checkout`, {
        data: { plan: 'pro' },
      });
      expect(response.status()).toBe(401);
    });
  });

  test.describe('Admin API', () => {
    test('GET /api/admin/users returns 403 for non-admin', async ({ request }) => {
      // Without proper auth, should return error
      const response = await request.get(`${baseURL}/api/admin/users`);
      expect([401, 403]).toContain(response.status());
    });
  });
});
