let sent = 0;
/** Report unexpected front-end errors to the API (stored in the admin error log). Throttled. */
export function reportClientError(error: unknown, path = window.location.pathname) {
  if (sent >= 5) return;
  sent++;
  const e = error instanceof Error ? error : new Error(String(error));
  fetch('/api/client-errors', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-RW1-Client': 'web' },
    body: JSON.stringify({ message: e.message.slice(0, 1000), stack: e.stack?.slice(0, 4000), path }),
  }).catch(() => undefined);
}
