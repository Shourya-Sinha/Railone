import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: AuthUser;
    }
  }
}
