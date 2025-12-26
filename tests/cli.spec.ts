import { test, expect } from '@playwright/test';

test.describe('CLI API Endpoints', () => {
  test('should return 400 for analytics without eventType', async ({ request }) => {
    const response = await request.post('/api/cli/analytics', {
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('eventType');
  });

  test('should return 400 for invalid eventType', async ({ request }) => {
    const response = await request.post('/api/cli/analytics', {
      data: { eventType: 'invalid_event' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Invalid eventType');
  });

  test('should accept valid analytics event without auth', async ({ request }) => {
    const response = await request.post('/api/cli/analytics', {
      data: {
        eventType: 'command_used',
        eventData: { command: 'test' },
      },
    });

    // Should succeed - anonymous tracking allowed
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('id');
  });

  test('should return 401 for pattern-gaps without auth', async ({ request }) => {
    const response = await request.post('/api/pattern-gaps', {
      data: {
        category: 'test',
        request: 'test request',
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe('Rate Limiting', () => {
  test('should allow normal request rate', async ({ request }) => {
    // Make 5 requests quickly - should all succeed
    const promises = Array(5).fill(null).map(() =>
      request.get('/api/health')
    );

    const responses = await Promise.all(promises);
    responses.forEach(response => {
      expect(response.ok()).toBeTruthy();
    });
  });
});
