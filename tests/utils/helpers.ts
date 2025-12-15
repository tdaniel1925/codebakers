import { Page, expect } from '@playwright/test';

export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function fillField(page: Page, label: string, value: string) {
  await page.getByLabel(label).fill(value);
}

export async function clickButton(page: Page, text: string) {
  await page.getByRole('button', { name: text }).click();
}

export async function expectToast(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible({ timeout: 5000 });
}

export async function expectError(page: Page, message: string) {
  await expect(page.getByText(message)).toBeVisible();
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await fillField(page, 'Email', email);
  await fillField(page, 'Password', password);
  await clickButton(page, 'Sign In');
  await page.waitForURL('/dashboard');
}
