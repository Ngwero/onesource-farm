import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { normalizeUserProfile } from '@/lib/auth/profile';
import type { User } from '@/types';

const DEV_SESSION_COOKIE = 'rukapay_dev_session';
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
}

export function clearAppSessionCookie(response: NextResponse): void {
  response.cookies.delete(DEV_SESSION_COOKIE);
}

export async function setDevSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(DEV_SESSION_COOKIE, signDevPayload(userId), sessionCookieOptions);
}

export async function clearDevSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DEV_SESSION_COOKIE);
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
  if (devUserId) {
    const profile = await loadProfile(devUserId);
    if (profile) return profile;
  }

  const supabaseUserId = await getUserIdFromSupabaseSession();
  if (supabaseUserId) return loadProfile(supabaseUserId);

  return null;
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
