import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

/** Prepares the isolated test schema: apply migrations, then load the sample stations and demo accounts. */
export default function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL as string;
  const env = { ...process.env, DATABASE_URL: url };
  const safe = url.replace(/\/\/[^@]*@/, '//***@');
  console.log(`[test-db] preparing ${safe}`);
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });
}
