import { test, expect } from '@playwright/test';

test.describe('API Routes - Unauthenticated', () => {
  test('should return 401 for protected /api/keys endpoint', async ({ request }) => {
    const response = await request.get('/api/keys');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('code', 'AUTHENTICATION_ERROR');
  });

  test('should return 401 for /api/content without Bearer token', async ({ request }) => {
    const response = await request.get('/api/content');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 401 for /api/content with invalid Bearer token', async ({ request }) => {
    const response = await request.get('/api/content', {
      headers: {
        Authorization: 'Bearer invalid-key',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'Invalid API key');
  });

  test('should return 401 for /api/billing/portal endpoint', async ({ request }) => {
    const response = await request.post('/api/billing/portal');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('should return 401 for admin stats endpoint', async ({ request }) => {
    const response = await request.get('/api/admin/stats');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('code', 'AUTHENTICATION_ERROR');
  });
});

test.describe('API Routes - Validation', () => {
  test('should return 401 for checkout without auth', async ({ request }) => {
    const response = await request.post('/api/billing/checkout', {
      data: { plan: 'pro' },
    });

    // Auth is checked first, so 401
    expect(response.status()).toBe(401);
  });
});

test.describe('API Routes - Security Headers', () => {
  test('should include security headers in response', async ({ request }) => {
    const response = await request.get('/api/health');

    // Check security headers are present
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBe('SAMEORIGIN');
  });
});
