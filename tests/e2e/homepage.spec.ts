import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CodeBakers/);
  });

  test('should display hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /ship production-ready/i })).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Compare' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
  });

  test('should navigate to pricing page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL('/pricing');
    await expect(page.getByRole('heading', { name: /pricing/i })).toBeVisible();
  });

  test('should navigate to compare page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Compare' }).click();
    await expect(page).toHaveURL('/compare');
  });

  test('should navigate to signup from CTA', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started' }).first().click();
    await expect(page).toHaveURL('/signup');
  });
});
