import { test, expect } from '@playwright/test';

test.describe('Marketing Pages', () => {
  test('homepage should load and display hero section', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/CodeBakers/);

    // Check hero content - new revolutionary positioning
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check CTA buttons exist
    await expect(page.getByRole('link', { name: /start|free|try/i }).first()).toBeVisible();
  });

  test('homepage should display CodeBakers features', async ({ page }) => {
    await page.goto('/');

    // Should show production-ready code messaging
    await expect(page.getByText(/production|pattern|module/i).first()).toBeVisible();

    // Should show AI or code-related messaging
    await expect(page.getByText(/ai|code|build/i).first()).toBeVisible();
  });

  test('pricing page should load and show plans', async ({ page }) => {
    await page.goto('/pricing');

    // Check page loaded
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check all plans are visible (Pro, Team, Enterprise)
    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
    await expect(page.getByText('Enterprise').first()).toBeVisible();
  });

  test('pricing page should show correct feature counts', async ({ page }) => {
    await page.goto('/pricing');

    // Should show 59 modules in features (CODEBAKERS_STATS.moduleCount)
    await expect(page.getByText(/59.*modules/i).first()).toBeVisible();

    // Should show module/pattern related text
    await expect(page.getByText(/module|pattern/i).first()).toBeVisible();
  });

  test('compare page should load and show savings table', async ({ page }) => {
    await page.goto('/compare');

    // Check page loaded
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Check comparison items exist
    await expect(page.getByText('Complete Auth System')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate between marketing pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to pricing
    await page.getByRole('link', { name: /pricing/i }).first().click();
    await expect(page).toHaveURL(/.*pricing/);

    // Navigate back home
    await page.getByRole('link', { name: /codebakers|home/i }).first().click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('Auth Pages', () => {
  test('login page should load', async ({ page }) => {
    await page.goto('/login');

    // Check login form exists
    await expect(page.getByText('Welcome back').first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('signup page should load', async ({ page }) => {
    await page.goto('/signup');

    // Check signup form exists
    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should redirect unauthenticated users from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/);
  });
});
