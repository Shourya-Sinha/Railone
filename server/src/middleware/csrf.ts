import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CLIENT_HEADER = 'x-rw1-client';

/**
 * CSRF defence in depth. Session cookies are SameSite=Lax, and every state-changing
 * request must carry a custom header, which browsers will not send cross-origin
 * without a successful CORS preflight.
 */
export const requireClientHeader: RequestHandler = (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  if (!req.header(CLIENT_HEADER)) {
    return next(new AppError(403, 'FORBIDDEN', 'Missing client header'));
  }
  next();
};
