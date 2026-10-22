import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parse } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';

export const systemRouter = Router();

/** Liveness/readiness probe (no sensitive details). */
systemRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'railwayone-pro-api', demo: true, time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'railwayone-pro-api', demo: true });
  }
});

const ClientError = z.object({
  message: z.string().max(1000),
  stack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
});

/** Front-end error reporting endpoint (stored in ErrorLog with source = web). */
systemRouter.post('/client-errors', authLimiter, async (req, res) => {
  const body = parse(ClientError, req.body);
  await prisma.errorLog.create({
    data: { level: 'error', source: 'web', message: body.message, stack: body.stack ?? null, path: body.path ?? null, userId: req.user?.id ?? null, requestId: req.id },
  });
  res.status(202).json({ ok: true });
});
