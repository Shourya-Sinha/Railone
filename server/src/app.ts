import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, corsOrigins } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { requireClientHeader } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { loadSession, requireAuth, requireRole } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { stationsRouter } from './routes/stations.js';
import { faresPublicRouter, journeyRouter } from './routes/journey.js';
import { bookingsRouter } from './routes/bookings.js';
import { accountRouter } from './routes/account.js';
import { adminRouter } from './routes/admin.js';
import { systemRouter } from './routes/system.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  const frameAncestors = env.FRAME_ANCESTORS.split(/\s+/).filter(Boolean);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          frameAncestors,
          objectSrc: ["'none'"],
          upgradeInsecureRequests: env.COOKIE_SECURE ? [] : null,
        },
      },
      frameguard: frameAncestors.includes('*') ? false : { action: 'sameorigin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ origin: corsOrigins, credentials: true, allowedHeaders: ['Content-Type', 'X-RW1-Client', 'X-Request-Id'] }));
  app.use(requestId);
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  // ── API ──
  const api = express.Router();
  api.use(apiLimiter);
  api.use(requireClientHeader);
  api.use(loadSession);
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Demo-Notice', 'RailwayOne Pro demo prototype - mock data - not an official railway service');
    next();
  });

  api.use('/', systemRouter);
  api.use('/auth', authRouter);
  api.use('/stations', stationsRouter);
  api.use('/fares', faresPublicRouter);
  api.use('/admin', requireRole('ADMIN'), adminRouter);
  api.use('/bookings', requireAuth, bookingsRouter);
  api.use('/', requireAuth, journeyRouter);
  api.use('/', requireAuth, accountRouter);
  api.use(apiNotFound);
  app.use('/api', api);

  // ── Static front-end (production build) ──
  const here = path.dirname(fileURLToPath(import.meta.url));
  const webDist = env.WEB_DIST_DIR ? path.resolve(env.WEB_DIST_DIR) : path.resolve(here, '../../web/dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
