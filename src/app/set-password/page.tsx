'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { OneSourceLogo } from '@/components/brand/OneSourceLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { getPasswordStrength } from '@/lib/auth/passwordStrength';

export default function SetPasswordPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const completedRef = useRef(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const differentFromCurrent =
    newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;

  const canSubmit =
    strength.isAcceptable &&
    passwordsMatch &&
    differentFromCurrent &&
    currentPassword.length > 0 &&
    !submitting;

  useEffect(() => {
    if (loading || completedRef.current) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.must_set_password) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  function handleBack() {
    logout();
    router.push('/login');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!strength.isAcceptable) {
      setError(strength.rejectionReason || 'Please meet all password requirements below.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      completedRef.current = true;
      sessionStorage.setItem('rukapay_password_ready', '1');
      if (data.welcome_email_sent) {
        sessionStorage.setItem(
          'rukapay_welcome_notice',
          'Welcome email sent — check your inbox and spam for “Welcome to the paperless era”.'
        );
      } else {
        sessionStorage.setItem(
          'rukapay_welcome_notice',
          'Password saved. If you do not see a welcome email, check spam or sign in again once SMTP is configured.'
        );
      }
      logout();
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="login-scene">
      <div className="login-orb login-orb--forest" aria-hidden />
      <div className="login-orb login-orb--leaf" aria-hidden />

      <div className="login-glass max-w-md w-full">
        <button
          type="button"
          onClick={handleBack}
          disabled={submitting}
          className="login-back mb-5 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to sign in
        </button>

        <div className="login-logo-mark">
          <OneSourceLogo width={180} variant="full" priority centered />
        </div>

        <h1 className="login-title">Set your password</h1>
        <p className="login-subtitle">
          Welcome, {user.full_name}. Create a strong password (at least 10 characters with upper,
          lower, number, and symbol). After you save, we email a short welcome note to{' '}
          <span className="text-white/90">{user.email}</span> (check spam if needed).
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            id="current"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            required
            autoComplete="current-password"
            variant="login"
          />
          <p className="text-xs text-white/50 -mt-2">
            First time? Enter the temporary password from your administrator.
          </p>

          <PasswordInput
            id="new"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            required
            minLength={10}
            autoComplete="new-password"
            showStrength
            variant="login"
          />

          <div>
            <PasswordInput
              id="confirm"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              minLength={10}
              autoComplete="new-password"
              variant="login"
            />
            {confirmPassword.length > 0 ? (
              <p
                className={`text-xs mt-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            ) : null}
            {currentPassword.length > 0 && newPassword.length > 0 && newPassword === currentPassword ? (
              <p className="text-xs mt-1.5 text-red-400">
                ✗ New password must be different from your current password
              </p>
            ) : null}
          </div>

          <button type="submit" disabled={!canSubmit} className="login-btn-pill w-full disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save password & sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
