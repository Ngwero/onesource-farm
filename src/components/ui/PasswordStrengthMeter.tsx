'use client';

import { getPasswordStrength } from '@/lib/auth/passwordStrength';

const BAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-brand-400',
  'bg-emerald-500',
];

const LABEL_COLORS = [
  'text-red-400',
  'text-orange-400',
  'text-amber-400',
  'text-brand-300',
  'text-emerald-400',
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="password-strength mt-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs text-white/60">Password strength</span>
        <span className={`text-xs font-semibold ${LABEL_COLORS[strength.score]}`}>
          {strength.label}
        </span>
      </div>
      <div className="password-strength-bars flex gap-1 mb-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              strength.score > i ? BAR_COLORS[strength.score] : 'bg-white/15'
            }`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-0.5 text-xs">
        <Check ok={strength.checks.length} label="At least 10 characters" />
        <Check ok={strength.checks.uppercase} label="One uppercase letter" />
        <Check ok={strength.checks.lowercase} label="One lowercase letter" />
        <Check ok={strength.checks.number} label="One number" />
        <Check ok={strength.checks.special} label="One special character" />
      </ul>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? 'text-emerald-400/90' : 'text-white/45'}>
      {ok ? '✓' : '○'} {label}
    </li>
  );
}
