import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CodeBakers/);
  });

  test('should display hero section', async ({ page }) => {
    await page.goto('/');
    // Check h1 is visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    // Check nav links exist
    await expect(page.getByRole('link', { name: /pricing/i }).first()).toBeVisible();
  });

  test('should navigate to pricing page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /pricing/i }).first().click();
    await expect(page).toHaveURL(/.*pricing/);
  });

  test('should navigate to compare page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /compare/i }).first().click();
    await expect(page).toHaveURL(/.*compare/);
  });

  test('should have CTA buttons', async ({ page }) => {
    await page.goto('/');
    // Check for signup/get started type buttons
    await expect(page.getByRole('link', { name: /start|sign up|get started/i }).first()).toBeVisible();
  });
});
