#!/bin/sh
set -e
echo "[entrypoint] applying database migrations…"
npx prisma migrate deploy
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] seeding demo data (idempotent)…"
  npx tsx prisma/seed.ts
fi
exec "$@"
