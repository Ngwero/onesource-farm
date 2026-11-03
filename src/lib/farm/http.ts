import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { AuthError } from '@/lib/auth/session';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

type PostgrestLikeError = { code?: string; message?: string; details?: string | null };

function isPostgrestError(err: unknown): err is PostgrestLikeError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Postgres constraint violations surface as user-readable messages, never raw SQL errors. */
function postgrestResponse(err: PostgrestLikeError): NextResponse {
  const detail = err.details || '';
  switch (err.code) {
    case '23505': {
      const field = /Key \(([^)]+)\)/.exec(detail)?.[1]?.split(',').pop()?.trim();
      return NextResponse.json(
        {
          error: field
            ? `A record with this ${field.replace(/_/g, ' ')} already exists.`
            : 'This record already exists.',
        },
        { status: 409 }
      );
    }
    case '23503':
      return NextResponse.json(
        {
          error: /still referenced/.test(detail)
            ? 'This record is used by other records and cannot be deleted. Mark it inactive instead.'
            : 'A linked record does not exist or does not match.',
        },
        { status: 409 }
      );
    case '23514':
    case '23502':
    case '22P02':
      return NextResponse.json({ error: 'Some values are invalid.' }, { status: 400 });
    case 'P0001':
      return NextResponse.json({ error: err.message }, { status: 400 });
    case 'P0002':
    case 'PGRST116':
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    case '42P01':
    case 'PGRST205':
      return NextResponse.json(
        {
          error:
            'Export tables are not set up on this database yet. Apply migration 025 (buyers, contracts, shipments) and try again.',
        },
        { status: 503 }
      );
    default: {
      const msg = err.message ?? '';
      if (/does not exist|schema cache/i.test(msg)) {
        return NextResponse.json(
          {
            error:
              'Export tables are not set up on this database yet. Apply migration 025 (buyers, contracts, shipments) and try again.',
          },
          { status: 503 }
        );
      }
      console.error('Database error:', err);
      return NextResponse.json({ error: 'Database request failed' }, { status: 500 });
    }
  }
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: err.message, fieldErrors: err.fieldErrors },
      { status: err.status }
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Please correct the highlighted fields.', fieldErrors: zodFieldErrors(err) },
      { status: 400 }
    );
  }
  if (isPostgrestError(err)) return postgrestResponse(err);
  console.error('Route error:', err);
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError('Request body must be JSON', 400);
  }
  return emptyStringsToNull(schema.parse(raw));
}

/** Form inputs send "" for cleared optional fields; store those as NULL. */
export function emptyStringsToNull<T>(value: T): T {
  if (value === '') return null as T;
  if (Array.isArray(value)) return value.map(emptyStringsToNull) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, emptyStringsToNull(v)])
    ) as T;
  }
  return value;
}

export function notFound(message = 'Not found'): never {
  throw new HttpError(message, 404);
}
