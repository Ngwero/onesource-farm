'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { OneSourceLogo } from '@/components/brand/OneSourceLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { user, loading: authLoading, login, dashboardRoute } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (authLoading) return;
    if (user?.must_set_password) {
      router.replace('/set-password');
      return;
    }
    if (user) {
      router.replace(dashboardRoute);
    }
  }, [user, authLoading, dashboardRoute, router]);

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setSuccess('If an account exists for that email, we sent a password reset link. Check inbox and spam.');
    }
    if (searchParams.get('reason') === 'timeout') {
      setError('Your session expired after 20 minutes of inactivity. Please sign in again.');
    }
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  useEffect(() => {
    const welcomeNotice = sessionStorage.getItem('onesource_welcome_notice');
    if (welcomeNotice) {
      sessionStorage.removeItem('onesource_welcome_notice');
    }
    if (sessionStorage.getItem('onesource_password_ready') === '1') {
      sessionStorage.removeItem('onesource_password_ready');
      const base = 'Password saved successfully. Sign in with your new password.';
      setSuccess(welcomeNotice ? `${base} ${welcomeNotice}` : base);
    } else if (welcomeNotice) {
      setSuccess(welcomeNotice);
    }
  }, []);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail || email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(
        data.message ||
          'If an account exists, a reset link was sent. Open it and choose a new password on the next page.'
      );
      setForgotOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const mustSetPassword = await login(email, password);
      router.push(mustSetPassword ? '/set-password' : dashboardRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-scene">
      <div className="login-orb login-orb--forest" aria-hidden />
      <div className="login-orb login-orb--leaf" aria-hidden />
      <div className="login-orb login-orb--deep" aria-hidden />

      <div className="login-glass">
        <div className="login-logo-mark">
          <OneSourceLogo width={200} variant="full" priority centered />
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">Enter your details to access your account</p>
        <p className="text-xs text-center text-white/50 -mt-2 mb-4">
          First time? Use the temporary password from your administrator, then set your own.
        </p>

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}
        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email" className="login-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
          </div>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
            variant="login"
            labelExtra={
              <div className="login-password-head">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <button
                  type="button"
                  className="login-link"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                    setError('');
                  }}
                >
                  Forgot password?
                </button>
              </div>
            }
          />

          <button type="submit" disabled={loading} className="login-btn-pill">
            {loading ? 'Signing in...' : 'Sign in to Dashboard'}
          </button>
        </form>

        {forgotOpen && (
          <form
            onSubmit={handleForgotPassword}
            className="mt-4 p-4 rounded-lg border border-white/20 bg-white/5 space-y-3"
          >
            <p className="text-sm text-white/80">Reset link will be sent to your work email.</p>
            <input
              type="email"
              className="login-input"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@email.com"
              required
            />
            <div className="flex gap-2">
              <button type="submit" disabled={forgotLoading} className="login-btn-pill flex-1 text-sm py-2">
                {forgotLoading ? 'Sending...' : 'Send reset link'}
              </button>
              <button
                type="button"
                className="login-link text-sm"
                onClick={() => setForgotOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="login-footer">
          Internal access only.{' '}
          <button
            type="button"
            className="login-link-inline"
            onClick={() =>
              setError('Request access from your OneSource Farm system administrator.')
            }
          >
            Need help?
          </button>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center page-shell">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-200 border-t-brand-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
