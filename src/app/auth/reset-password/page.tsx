'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { RukaPayLogo } from '@/components/brand/RukaPayLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { getPasswordStrength } from '@/lib/auth/passwordStrength';

export default function AuthResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    ready && strength.isAcceptable && passwordsMatch && newPassword.length > 0 && !submitting;

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!strength.isAcceptable) {
      setError(strength.rejectionReason || 'Please meet all password requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw new Error(updateError.message);

      await fetch('/api/auth/complete-recovery', { method: 'POST', credentials: 'include' });

      await supabase.auth.signOut();
      sessionStorage.setItem(
        'rukapay_password_ready',
        '1'
      );
      sessionStorage.setItem(
        'rukapay_welcome_notice',
        'Password updated. Sign in with your new password.'
      );
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center page-shell">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="login-scene">
        <div className="login-glass max-w-md w-full text-center">
          <h1 className="login-title text-xl">Link expired</h1>
          <p className="login-subtitle mt-2">
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
          <Link href="/login" className="login-btn-pill inline-block mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-scene">
      <div className="login-orb login-orb--navy" aria-hidden />
      <div className="login-orb login-orb--blue" aria-hidden />

      <div className="login-glass max-w-md w-full">
        <Link
          href="/login"
          className="login-back mb-5 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <div className="login-logo-mark">
          <RukaPayLogo width={180} variant="full" priority centered />
        </div>

        <h1 className="login-title">Choose a new password</h1>
        <p className="login-subtitle">
          Enter a strong password (10+ characters with upper, lower, number, and symbol).
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className={`text-xs ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
            </p>
          ) : null}

          <button type="submit" disabled={!canSubmit} className="login-btn-pill w-full disabled:opacity-50">
            {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
