import { defineConfig } from 'vitest/config';

/**
 * Integration tests never touch the development data: they run against DATABASE_URL_TEST, or
 * by default the same server with a separate Postgres schema (`rw1_test`). tests/globalSetup.ts
 * migrates and seeds that schema before the run.
 */
function testDatabaseUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const u = new URL(base);
  u.searchParams.set('schema', 'rw1_test');
  return u.toString();
}
const DATABASE_URL = testDatabaseUrl();

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test', ...(DATABASE_URL ? { DATABASE_URL } : {}) },
    include: ['tests/**/*.test.ts'],
    globalSetup: DATABASE_URL ? ['./tests/globalSetup.ts'] : [],
    testTimeout: 20000,
    hookTimeout: 30000,
    // integration tests share one database; run files sequentially
    fileParallelism: false,
  },
});
