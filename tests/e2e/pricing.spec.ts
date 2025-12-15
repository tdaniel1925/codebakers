import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test('should display all pricing tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Pro')).toBeVisible();
    await expect(page.getByText('Team')).toBeVisible();
    await expect(page.getByText('Agency')).toBeVisible();
  });

  test('should show correct prices', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('$49')).toBeVisible();
    await expect(page.getByText('$149')).toBeVisible();
    await expect(page.getByText('$349')).toBeVisible();
  });

  test('should have CTA buttons for each plan', async ({ page }) => {
    await page.goto('/pricing');
    const buttons = page.getByRole('button', { name: /get started/i });
    await expect(buttons).toHaveCount(3);
  });

  test('should display FAQ section', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Frequently Asked Questions')).toBeVisible();
    await expect(page.getByText(/which ai tools/i)).toBeVisible();
    await expect(page.getByText(/cancel anytime/i)).toBeVisible();
  });

  test('should highlight popular plan', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Most Popular')).toBeVisible();
  });
});
