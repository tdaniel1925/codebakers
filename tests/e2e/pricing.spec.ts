import { test, expect } from '@playwright/test';

test.describe('Pricing Page', () => {
  test('should display all pricing tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
    await expect(page.getByText('Enterprise').first()).toBeVisible();
  });

  test('should show plan descriptions', async ({ page }) => {
    await page.goto('/pricing');
    // Check that plan descriptions are visible
    await expect(page.getByText(/save.*hours|growing teams|unlimited/i).first()).toBeVisible();
    await expect(page.getByText(/team/i).first()).toBeVisible();
  });

  test('should have CTA buttons for each plan', async ({ page }) => {
    await page.goto('/pricing');
    // Check for Get Started or Contact Us buttons
    const buttons = page.getByRole('link', { name: /get started|contact/i });
    await expect(buttons.first()).toBeVisible();
  });

  test('should display FAQ section', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Frequently Asked Questions')).toBeVisible();
  });

  test('should highlight popular plan', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText('Most Popular')).toBeVisible();
  });
});
