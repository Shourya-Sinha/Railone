import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { parse } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { createSession, destroySession, SESSION_COOKIE } from '../services/session.js';
import { audit, notify } from '../services/audit.js';

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: PasswordSchema,
});
const LoginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Enter your password').max(128),
});

export const userDTO = (u: { id: string; email: string; name: string; phone: string | null; role: string; walletBalancePaise: number; preferences: unknown; createdAt: Date }) => ({
  id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role, walletBalancePaise: u.walletBalancePaise, preferences: u.preferences ?? {}, createdAt: u.createdAt,
});

export const authRouter = Router();
const WELCOME_CREDIT_PAISE = 50_000; // ₹500 demo credits

authRouter.post('/register', authLimiter, async (req, res) => {
  const body = parse(RegisterSchema, req.body);
  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new AppError(409, 'CONFLICT', 'An account with this email already exists', { fields: [{ field: 'email', message: 'Email already registered' }] });
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, phone: body.phone ?? null, passwordHash: await hashPassword(body.password), walletBalancePaise: WELCOME_CREDIT_PAISE },
  });
  await prisma.transaction.create({
    data: { txnRef: `DTXNWELCOME${user.id.slice(-8).toUpperCase()}`, userId: user.id, type: 'WALLET_TOPUP', status: 'SUCCESS', method: 'WALLET', amountPaise: WELCOME_CREDIT_PAISE, balanceAfterPaise: WELCOME_CREDIT_PAISE, meta: { instrument: 'Welcome demo credits' } },
  });
  await notify(prisma, user.id, { kind: 'WELCOME', title: 'Welcome to RailwayOne Pro', body: 'Your demo account is ready with ₹500 of demo wallet credits. Remember: all tickets are DEMO ONLY.', link: '/' });
  await audit('USER_REGISTERED', 'User', { entityId: user.id, actorId: user.id, ip: req.ip });
  await createSession(res, req, user.id);
  res.status(201).json({ user: userDTO(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = parse(LoginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Always run a hash comparison to reduce user-enumeration timing differences.
  const ok = await verifyPassword(body.password, user?.passwordHash ?? 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
  if (!user || !ok) {
    await audit('LOGIN_FAILED', 'User', { entityId: user?.id, ip: req.ip, meta: { email: body.email } });
    throw new AppError(401, 'UNAUTHENTICATED', 'Incorrect email or password');
  }
  if (user.disabled) throw new AppError(403, 'FORBIDDEN', 'This demo account has been disabled by an administrator');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(res, req, user.id);
  await audit('LOGIN', 'User', { entityId: user.id, actorId: user.id, ip: req.ip });
  res.json({ user: userDTO(user) });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(res, req.cookies?.[SESSION_COOKIE]);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
  res.json({ user: userDTO(user), unreadNotifications: unread });
});
