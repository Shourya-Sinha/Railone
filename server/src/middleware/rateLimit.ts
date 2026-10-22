import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const handler = (_req: unknown, res: import('express').Response) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' } });

export const apiLimiter = rateLimit({ windowMs: 15 * 60_000, limit: env.RATE_LIMIT_MAX, standardHeaders: 'draft-8', legacyHeaders: false, handler });
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: env.AUTH_RATE_LIMIT_MAX, standardHeaders: 'draft-8', legacyHeaders: false, handler });
export const paymentLimiter = rateLimit({ windowMs: 10 * 60_000, limit: env.PAYMENT_RATE_LIMIT_MAX, standardHeaders: 'draft-8', legacyHeaders: false, handler });
