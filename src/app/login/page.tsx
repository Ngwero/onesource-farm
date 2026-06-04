'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RukaPayLogo } from '@/components/brand/RukaPayLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';

export default function LoginPage() {
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
    if (sessionStorage.getItem('rukapay_password_ready') === '1') {
      sessionStorage.removeItem('rukapay_password_ready');
      setSuccess('Password saved successfully. Sign in with your new password.');
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
      setSuccess(data.message || 'Check your email for a reset link.');
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
      <div className="login-orb login-orb--navy" aria-hidden />
      <div className="login-orb login-orb--blue" aria-hidden />
      <div className="login-orb login-orb--deep" aria-hidden />

      <div className="login-glass">
        <div className="login-logo-mark">
          <RukaPayLogo width={200} variant="full" priority centered />
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
              placeholder="name@rukapay.co.ug"
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
              setError('Request access from your RukaPay system administrator.')
            }
          >
            Need help?
          </button>
        </p>
      </div>
    </div>
  );
}
