import { z } from 'zod';

/**
 * Centralised, validated environment configuration.
 * Secrets are never hard-coded: the process refuses to start if they are missing.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 30).default(72),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  FRAME_ANCESTORS: z.string().default("'self'"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  PAYMENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  WEB_DIST_DIR: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n[config] Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill in the values.\n`);
    process.exit(1);
  }
  if (parsed.data.SESSION_SECRET.startsWith('change-me') && parsed.data.NODE_ENV === 'production') {
    console.error('[config] Refusing to start in production with the example SESSION_SECRET.');
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const corsOrigins = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
