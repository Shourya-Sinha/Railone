export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INVALID_JOURNEY'
  | 'PAYMENT_FAILED'
  | 'INSUFFICIENT_BALANCE'
  | 'BOOKING_NOT_PAYABLE'
  | 'BOOKING_NOT_CANCELLABLE'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR';

/** An error that is safe to expose to API clients. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', msg, details);
export const invalidJourney = (msg: string, details?: unknown) => new AppError(422, 'INVALID_JOURNEY', msg, details);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const unauthenticated = (msg = 'Please sign in to continue') => new AppError(401, 'UNAUTHENTICATED', msg);
export const forbidden = (msg = 'You do not have permission to perform this action') => new AppError(403, 'FORBIDDEN', msg);
