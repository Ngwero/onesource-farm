import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

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

export async function farmFetch<T>(
  url: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
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
