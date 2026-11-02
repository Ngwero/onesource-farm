import type { NextRequest } from 'next/server';

const PRODUCTION_APP_URL = 'https://onesourcefresh.com';

/** Portal link for go-live announcement emails (always production when app runs on Vercel). */
export function resolveLaunchEmailAppUrl(request?: NextRequest): string {
  const override = process.env.LAUNCH_EMAIL_APP_URL?.trim().replace(/\/$/, '');
  if (override) return override;

  const resolved = resolveAppUrl(request);
  if (!resolved.includes('localhost')) return resolved;

  return PRODUCTION_APP_URL;
}

/** Canonical app URL for auth redirects (emails, Supabase allow-list). */
export function resolveAppUrl(request?: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured && !configured.includes('localhost')) {
    return configured;
  }

  if (request) {
    const host =
      request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      request.headers.get('host')?.trim();
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    if (host && !host.includes('localhost')) {
      return `${proto}://${host}`;
    }
  }

  return configured || 'http://localhost:3000';
}

/** Supabase allow-list friendly — no query string (use callback default next path). */
export function authCallbackUrl(request?: NextRequest): string {
  const override = process.env.SUPABASE_AUTH_REDIRECT_URL?.trim().replace(/\/$/, '');
  if (override) return override;
  return `${resolveAppUrl(request)}/auth/callback`;
}
