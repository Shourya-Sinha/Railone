import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export const SESSION_COOKIE = 'rw1_session';

/** Session tokens are random; only an HMAC of the token is stored server-side. */
export const hashToken = (token: string) => crypto.createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');

export async function createSession(res: Response, req: Request, userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = env.SESSION_TTL_HOURS * 3600_000;
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      userAgent: req.header('user-agent')?.slice(0, 255) ?? null,
      ip: req.ip ?? null,
      expiresAt: new Date(Date.now() + maxAge),
    },
  });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE, maxAge, path: '/' });
}

export async function destroySession(res: Response, token?: string) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}
