import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../lib/errors.js';

/** Parse untrusted input with a Zod schema, throwing a consistent 400 error on failure. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
    throw new AppError(400, 'VALIDATION_ERROR', fields[0]?.message ?? 'Invalid request', { fields });
  }
  return result.data;
}
