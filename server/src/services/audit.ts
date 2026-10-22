import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** Append-only audit trail for demo transactions and administrative actions. */
export function audit(
  action: string,
  entity: string,
  opts: { entityId?: string | null; actorId?: string | null; meta?: Prisma.InputJsonValue; ip?: string | null; db?: Db } = {},
) {
  const db = opts.db ?? prisma;
  return db.auditLog.create({
    data: { action, entity, entityId: opts.entityId ?? null, actorId: opts.actorId ?? null, meta: opts.meta, ip: opts.ip ?? null },
  });
}

export function notify(db: Db, userId: string, n: { kind: string; title: string; body: string; link?: string }) {
  return db.notification.create({ data: { userId, ...n } });
}
