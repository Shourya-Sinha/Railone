import { test as setup, expect } from '@playwright/test';
import { ADMIN, DEMO, ADMIN_STATE, DEMO_STATE } from './fixtures';

for (const [who, creds, file] of [['demo user', DEMO, DEMO_STATE], ['admin', ADMIN, ADMIN_STATE]] as const) {
  setup(`sign in as ${who}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(creds.email);
    await page.getByLabel('Password', { exact: true }).fill(creds.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.context().storageState({ path: file });
  });
}
