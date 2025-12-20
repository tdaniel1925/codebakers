import { test, expect } from '@playwright/test';
import { fillField, clickButton } from '../utils/helpers';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should render login form', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/login');
      await clickButton(page, 'Sign In');
      // Form validation should prevent submission
      await expect(page).toHaveURL('/login');
    });

    test('should validate email field', async ({ page }) => {
      await page.goto('/login');
      // Browser or Zod validates email format
      const emailInput = page.getByLabel('Email');
      await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('should have link to signup', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    });

    test('password field should hide input', async ({ page }) => {
      await page.goto('/login');
      const passwordField = page.getByLabel('Password');
      await expect(passwordField).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Signup Page', () => {
    test('should render signup form', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByLabel('Full Name')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    });

    test('should show validation error for short password', async ({ page }) => {
      await page.goto('/signup');
      await fillField(page, 'Full Name', 'Test User');
      await fillField(page, 'Email', 'test@example.com');
      await fillField(page, 'Password', 'short');
      await clickButton(page, 'Create Account');
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    });

    test('should have link to login', async ({ page }) => {
      await page.goto('/signup');
      await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    });
  });
});
