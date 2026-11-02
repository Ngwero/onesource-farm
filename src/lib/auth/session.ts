import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { normalizeUserProfile } from '@/lib/auth/profile';
import { SESSION_INACTIVITY_MS, SESSION_INACTIVITY_SECONDS } from '@/lib/auth/inactivity';
import type { User } from '@/types';

const DEV_SESSION_COOKIE = 'onesource_dev_session';
const LAST_ACTIVITY_COOKIE = 'onesource_last_activity';
const DEV_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function sessionSecret(): string {
  return process.env.JWT_SECRET || 'dev-only-change-in-production';
}

function signDevPayload(userId: string): string {
  const exp = Date.now() + DEV_SESSION_MAX_AGE * 1000;
  const payload = `${userId}:${exp}`;
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function verifyDevToken(token: string): string | null {
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = createHmac('sha256', sessionSecret())
    .update(`${userId}:${expStr}`)
    .digest('hex');
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return userId;
}

function signActivityPayload(timestamp: number): string {
  const payload = String(timestamp);
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function verifyActivityToken(token: string): number | null {
  const parts = token.split(':');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const timestamp = Number(payload);
  if (!Number.isFinite(timestamp)) return null;
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  if (Date.now() - timestamp > SESSION_INACTIVITY_MS) return null;
  return timestamp;
}

type SessionActivityState = 'valid' | 'expired' | 'missing';

async function getSessionActivityState(): Promise<SessionActivityState> {
  const cookieStore = await cookies();
  const token = cookieStore.get(LAST_ACTIVITY_COOKIE)?.value;
  if (!token) return 'missing';
  return verifyActivityToken(token) === null ? 'expired' : 'valid';
}

const activityCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_INACTIVITY_SECONDS,
};

function attachSessionActivityCookie(response: NextResponse): void {
  response.cookies.set(
    LAST_ACTIVITY_COOKIE,
    signActivityPayload(Date.now()),
    activityCookieOptions
  );
}

async function touchSessionActivityCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    LAST_ACTIVITY_COOKIE,
    signActivityPayload(Date.now()),
    activityCookieOptions
  );
}

async function clearAllSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);
  cookieStore.delete(LAST_ACTIVITY_COOKIE);
}

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: DEV_SESSION_MAX_AGE,
};

/** Signed app session cookie for API routes (set on login and /api/auth/me). */
export function attachAppSessionCookie(response: NextResponse, userId: string): void {
  response.cookies.set(DEV_SESSION_COOKIE, signDevPayload(userId), sessionCookieOptions);
  attachSessionActivityCookie(response);
}

export function clearAppSessionCookie(response: NextResponse): void {
  response.cookies.delete(DEV_SESSION_COOKIE);
  response.cookies.delete(LAST_ACTIVITY_COOKIE);
}

export async function setDevSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, signDevPayload(userId), sessionCookieOptions);
}

export async function clearDevSessionCookie(): Promise<void> {
  await clearAllSessionCookies();
}

/** Refresh the inactivity window (authenticated API / touch route). */
export async function touchSessionActivity(): Promise<void> {
  await touchSessionActivityCookie();
}

async function loadProfile(userId: string): Promise<User | null> {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('users')
    .select('*, roles(slug, name), departments(name, code)')
    .eq('id', userId)
    .eq('is_active', true)
    .single();
  return normalizeUserProfile(profile as Record<string, unknown> | null);
}

async function getUserIdFromSupabaseSession(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getUserIdFromDevCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEV_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyDevToken(token);
}

/** Resolve authenticated user from app session cookie or Supabase session. */
export async function getAuthUser(): Promise<User | null> {
  const devUserId = await getUserIdFromDevCookie();
  const supabaseUserId = devUserId ? null : await getUserIdFromSupabaseSession();
  const userId = devUserId ?? supabaseUserId;
  if (!userId) return null;

  const activity = await getSessionActivityState();
  if (activity === 'expired') {
    await clearAllSessionCookies();
    return null;
  }

  const profile = await loadProfile(userId);
  if (!profile) return null;

  await touchSessionActivityCookie();
  return profile;
}

/** Require authenticated active user (allows must_set_password for set-password flow). */
export async function requireAuth(options?: { allowMustSetPassword?: boolean }): Promise<User> {
  const user = await getAuthUser();
  if (!user) throw new AuthError('Unauthorized', 401);
  if (user.must_set_password && !options?.allowMustSetPassword) {
    throw new AuthError('Password change required', 403);
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role?.slug !== 'admin') throw new AuthError('Forbidden', 403);
  return user;
}

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'Request failed';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function withAuth<T>(
  handler: (user: User) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await requireAuth();
    return await handler(user);
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function withAdmin<T>(
  handler: (user: User) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await requireAdmin();
    return await handler(user);
  } catch (err) {
    return authErrorResponse(err);
  }
}
