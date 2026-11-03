import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { enqueueOutbox, type OutboxKind } from '@/lib/offline/outbox';

export class FarmApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'FarmApiError';
  }
}

const OFFLINE_WRITE_PATHS: { test: RegExp; kind: OutboxKind }[] = [
  { test: /^\/api\/farm\/activities(\/|$)/, kind: 'activity' },
  { test: /^\/api\/farm\/incidents(\/|$)/, kind: 'incident' },
  { test: /^\/api\/farm\/harvests(\/|$)/, kind: 'harvest' },
  { test: /^\/api\/farm\/attendance(\/|$)/, kind: 'attendance' },
];

function offlineKind(url: string): OutboxKind | null {
  const path = url.split('?')[0] ?? url;
  return OFFLINE_WRITE_PATHS.find((p) => p.test.test(path))?.kind ?? null;
}

/** Stub response so form sheets can close after queueing offline. */
function offlineStub(kind: OutboxKind, queuedId: string): Record<string, unknown> {
  switch (kind) {
    case 'activity':
      return { id: queuedId, queued: true };
    case 'incident':
      return { incident: { id: queuedId }, queued: true };
    case 'harvest':
      return { batch: { id: queuedId }, queued: true };
    case 'attendance':
      return { ok: true, queued: true };
    default:
      return { id: queuedId, queued: true };
  }
}

export async function farmFetch<T>(
  url: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const method = options.method ?? 'GET';
  const kind = offlineKind(url);

  if (
    typeof navigator !== 'undefined' &&
    !navigator.onLine &&
    kind &&
    (method === 'POST' || method === 'PATCH') &&
    options.body !== undefined
  ) {
    const item = await enqueueOutbox({
      kind,
      path: url,
      method,
      body: options.body,
    });
    return offlineStub(kind, item.id) as T;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    // Network failure while "online" — still queue field writes when possible.
    if (kind && (method === 'POST' || method === 'PATCH') && options.body !== undefined) {
      const item = await enqueueOutbox({
        kind,
        path: url,
        method,
        body: options.body,
      });
      return offlineStub(kind, item.id) as T;
    }
    throw err instanceof Error ? err : new FarmApiError('Network error', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new FarmApiError(data.error || `Request failed (${res.status})`, res.status, data.fieldErrors);
  }
  return data as T;
}

/** Show server-side field errors on the matching form inputs; returns true if any were applied. */
export function applyFieldErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): boolean {
  if (!(err instanceof FarmApiError) || !err.fieldErrors) return false;
  for (const [field, message] of Object.entries(err.fieldErrors)) {
    setError(field as Path<T>, { type: 'server', message });
  }
  return Object.keys(err.fieldErrors).length > 0;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
