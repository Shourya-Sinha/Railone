/** Thin fetch wrapper with a consistent error type. All calls go to the same-origin /api proxy. */
export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { fields?: FieldError[]; [k: string]: unknown },
    public requestId?: string,
  ) {
    super(message);
  }
  /** Map of field → first message, for form display. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of this.details?.fields ?? []) if (!out[f.field]) out[f.field] = f.message;
    return out;
  }
}

type Opts = { method?: string; body?: unknown; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-RW1-Client': 'web' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Unable to reach the server. Check your connection and try again.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_' + res.status, err?.message ?? `Request failed (${res.status})`, err?.details, err?.requestId);
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
