import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { expireStaleBookings } from './services/bookingService.js';
import { loadStations } from './services/stationCache.js';

async function main() {
  await prisma.$connect();
  const { all } = await loadStations();
  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`RailwayOne Pro API (DEMO) listening on http://0.0.0.0:${env.PORT}`, { stations: all.length, env: env.NODE_ENV });
  });

  // Background housekeeping: expire unpaid holds and purge expired sessions.
  const sweeper = setInterval(async () => {
    try {
      const expired = await expireStaleBookings();
      const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      if (expired || sessions.count) logger.info('Housekeeping', { expiredBookings: expired, purgedSessions: sessions.count });
    } catch (e) {
      logger.error('Housekeeping failed', { err: String(e) });
    }
  }, 60_000);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    clearInterval(sweeper);
    server.close(() => void prisma.$disconnect().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error('Fatal startup error', { err: String(e?.stack ?? e) });
  process.exit(1);
});
