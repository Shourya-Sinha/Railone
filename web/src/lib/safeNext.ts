/** Only same-origin relative paths are allowed as post-login redirects (prevents open redirects). */
export const safeNext = (next: string | null | undefined): string | null =>
  next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
