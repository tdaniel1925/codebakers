import { test, expect } from '@playwright/test';

test.describe('Billing & Payments', () => {
  test.describe('Billing Page', () => {
    test('should display billing page with pricing plans', async ({ page }) => {
      // Navigate to billing page
      await page.goto('/billing');

      // Check page loads
      await expect(page.locator('h1')).toContainText('Billing');

      // Check pricing plans are displayed
      await expect(page.locator('text=Pro')).toBeVisible();
      await expect(page.locator('text=Team')).toBeVisible();
      await expect(page.locator('text=Agency')).toBeVisible();

      // Check "Get Started" buttons are visible
      const getStartedButtons = page.locator('button:has-text("Get Started")');
      await expect(getStartedButtons).toHaveCount(3);
    });

    test('should display payment provider icons', async ({ page }) => {
      await page.goto('/billing');

      // Check payment provider indicators are shown
      await expect(page.locator('text=Pay with:')).toBeVisible();
    });

    test('should show FAQ section', async ({ page }) => {
      await page.goto('/billing');

      // Check FAQ is displayed
      await expect(page.locator('text=Frequently Asked Questions')).toBeVisible();
      await expect(page.locator('text=Can I cancel anytime?')).toBeVisible();
      await expect(page.locator('text=What payment methods do you accept?')).toBeVisible();
    });
  });

  test.describe('Checkout API', () => {
    test('should return 401 for unauthenticated Square checkout', async ({ request }) => {
      const response = await request.post('/api/billing/square/checkout', {
        data: { plan: 'pro' },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    test('should return 401 for unauthenticated PayPal checkout', async ({ request }) => {
      const response = await request.post('/api/billing/paypal/checkout', {
        data: { plan: 'pro' },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('AUTHENTICATION_ERROR');
    });

    test('should return 400 for invalid plan on Square checkout', async ({ request }) => {
      // This test would require authenticated request
      // Skipped since it requires auth setup
      test.skip();
    });
  });

  test.describe('Pricing API', () => {
    test('should return pricing plans', async ({ request }) => {
      const response = await request.get('/api/pricing');

      expect(response.status()).toBe(200);
      const body = await response.json();

      // Check response structure
      expect(body).toHaveProperty('plans');
      expect(Array.isArray(body.plans)).toBe(true);

      // Each plan should have required fields
      if (body.plans.length > 0) {
        const plan = body.plans[0];
        expect(plan).toHaveProperty('plan');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('priceMonthly');
        expect(plan).toHaveProperty('providers');
      }
    });

    test('should include provider availability in pricing', async ({ request }) => {
      const response = await request.get('/api/pricing');
      const body = await response.json();

      if (body.plans.length > 0) {
        const plan = body.plans[0];
        expect(plan.providers).toHaveProperty('stripe');
        expect(plan.providers).toHaveProperty('square');
        expect(plan.providers).toHaveProperty('paypal');
      }
    });
  });

  test.describe('Webhooks', () => {
    test('should reject Square webhook without signature', async ({ request }) => {
      const response = await request.post('/api/webhooks/square', {
        data: { type: 'subscription.created', data: {} },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('MISSING_SIGNATURE');
    });

    test('should reject Square webhook with invalid signature', async ({ request }) => {
      const response = await request.post('/api/webhooks/square', {
        headers: {
          'x-square-hmacsha256-signature': 'invalid-signature',
        },
        data: { type: 'subscription.created', data: {} },
      });

      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.code).toBe('INVALID_SIGNATURE');
    });

    test('should reject PayPal webhook with invalid signature', async ({ request }) => {
      const response = await request.post('/api/webhooks/paypal', {
        headers: {
          'paypal-auth-algo': 'SHA256withRSA',
          'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/CERT-123',
          'paypal-transmission-id': 'test-id',
          'paypal-transmission-sig': 'invalid-sig',
          'paypal-transmission-time': new Date().toISOString(),
        },
        data: {
          id: 'evt-123',
          event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
          resource: { id: 'sub-123' },
        },
      });

      // PayPal webhook should reject invalid signature
      expect(response.status()).toBe(401);
    });
  });
});
