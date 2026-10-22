import type { Page } from '@playwright/test';

export const DEMO = { email: process.env.SEED_DEMO_EMAIL ?? 'demo@railwayone.dev', password: process.env.SEED_DEMO_PASSWORD ?? 'Demo@12345' };
export const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@railwayone.dev', password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345' };
export const DEMO_STATE = 'test-results/.auth/demo.json';
export const ADMIN_STATE = 'test-results/.auth/admin.json';

/** Opens a station field and picks a station by searching its code. */
export async function pickStation(page: Page, field: 'From' | 'To' | 'Station', code: string) {
  await page.getByRole('button', { name: new RegExp(`^${field}:`) }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Search stations' }).fill(code);
  await dialog.getByRole('listbox', { name: 'Matching stations' }).getByRole('option').filter({ hasText: code }).first().click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}
