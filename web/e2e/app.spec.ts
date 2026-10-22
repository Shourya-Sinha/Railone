import { test, expect } from '@playwright/test';
import { ADMIN_STATE, DEMO, DEMO_STATE } from './fixtures';

test.describe('guest', () => {
  test('protected pages redirect to login; bad credentials show an error', async ({ page }) => {
    await page.goto('/wallet');
    await expect(page).toHaveURL(/\/login\?next=%2Fwallet/);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/enter (your|a valid) email/i).first()).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill(DEMO.email);
    await page.getByLabel('Password', { exact: true }).fill('wrong-password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /invalid|incorrect/i })).toBeVisible();
  });
});

test.describe('session lifecycle', () => {
  test('sign in, sign out, and protected pages require login again', async ({ page }) => {
    await page.goto('/login?next=%2Fprofile');
    await page.getByLabel('Email', { exact: true }).fill(DEMO.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByRole('button', { name: 'Sign out' }).filter({ visible: true }).last().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/tickets');
    await expect(page).toHaveURL(/\/login\?next=%2Ftickets/);
  });
});

test.describe('demo user', () => {
  test.use({ storageState: DEMO_STATE });

  test('home shows booking card, shortcuts and demo labelling', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/demo/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^From:/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /PNR/i }).filter({ visible: true }).first()).toBeVisible();
  });

  test('PNR and running status use clearly-labelled mock data', async ({ page }) => {
    await page.goto('/pnr?pnr=2451837690');
    await expect(page.getByText('2451837690').first()).toBeVisible();
    await expect(page.getByText(/mock|simulated|demo/i).filter({ visible: true }).first()).toBeVisible();
    await page.goto('/running-status?train=12345');
    await expect(page.getByText(/simulated|mock/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('non-admins cannot open the admin console', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/$/);
    const res = await page.request.get('/api/admin/stats');
    expect(res.status()).toBe(403);
  });
});

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('admin console: overview, stations search and logs', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Users', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.goto('/admin/stations?q=patna');
    await expect(page.getByRole('cell', { name: /PNBE/ })).toBeVisible();
    await page.goto('/admin/health');
    await expect(page.getByText(/operational|degraded/i)).toBeVisible();
    await page.goto('/admin/logs?tab=audit');
    await expect(page.getByRole('cell', { name: /LOGIN/ }).first()).toBeVisible();
  });
});
