import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the full stack (Express API + built web app on :4000).
 * Start Postgres, seed the DB, then: `npm run build && npm run test:e2e`.
 * Override the target with E2E_BASE_URL (e.g. http://localhost:5173 for the Vite dev server).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'en-IN', timezoneId: 'Asia/Kolkata' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } }, dependencies: ['setup'], testIgnore: /booking\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run start -w server', cwd: '..', url: `${baseURL}/api/health`, reuseExistingServer: true, timeout: 60_000 },
});
