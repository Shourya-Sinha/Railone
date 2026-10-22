import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { forbidden, unauthenticated } from '../lib/errors.js';
import { SESSION_COOKIE, hashToken } from '../services/session.js';

/** Resolve the session cookie (if any) into req.user. Never throws for anonymous requests. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 20 && token.length < 100) {
      const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
      if (session && session.expiresAt > new Date() && !session.user.disabled) {
        req.user = { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role, sessionId: session.id };
      }
    }
    next();
  } catch (e) {
    next(e);
  }
};

export const requireAuth: RequestHandler = (req, _res, next) => (req.user ? next() : next(unauthenticated()));

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthenticated());
    if (!roles.includes(req.user.role)) return next(forbidden('Administrator access required'));
    next();
  };
