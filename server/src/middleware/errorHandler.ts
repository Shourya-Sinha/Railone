import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No API route for ${req.method} ${req.path}`, requestId: req.id } });
};

/** Consistent error envelope: { error: { code, message, details?, requestId } } */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let appErr: AppError;
  if (err instanceof AppError) appErr = err;
  else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    appErr = new AppError(409, 'CONFLICT', 'A record with these details already exists');
  } else if (err?.type === 'entity.parse.failed') {
    appErr = new AppError(400, 'BAD_REQUEST', 'Malformed JSON body');
  } else if (err?.type === 'entity.too.large') {
    appErr = new AppError(413, 'BAD_REQUEST', 'Request body too large');
  } else {
    appErr = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }

  if (appErr.status >= 500) {
    logger.error('Unhandled error', { requestId: req.id, path: req.path, err: String(err?.stack ?? err) });
    prisma.errorLog
      .create({
        data: {
          level: 'error',
          source: 'server',
          message: String(err?.message ?? err).slice(0, 1000),
          stack: typeof err?.stack === 'string' ? err.stack.slice(0, 4000) : null,
          path: req.originalUrl.slice(0, 300),
          method: req.method,
          status: appErr.status,
          userId: req.user?.id ?? null,
          requestId: req.id,
        },
      })
      .catch(() => undefined);
  } else if (appErr.status !== 401 && appErr.status !== 404) {
    logger.warn(appErr.message, { requestId: req.id, code: appErr.code, path: req.path });
  }

  res.status(appErr.status).json({
    error: { code: appErr.code, message: appErr.message, ...(appErr.details ? { details: appErr.details } : {}), requestId: req.id },
  });
};
