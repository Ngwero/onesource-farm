export interface PasswordStrengthResult {
  score: number;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  percent: number;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
  isAcceptable: boolean;
  rejectionReason?: string;
}

const MIN_LENGTH = 10;

const DISALLOWED_PASSWORDS = new Set(
  [
    'Welcome@RukaPay2026',
    'password',
    'password1',
    'Password1',
    'Password123',
    '12345678',
    'qwerty123',
    'rukapay123',
  ].map((p) => p.toLowerCase())
);

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    length: password.length >= MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  let score = 0;
  if (checks.length) score += 1;
  if (password.length >= 14) score += 1;
  if (checks.uppercase && checks.lowercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;

  const capped = Math.min(4, Math.max(0, score - (!checks.length ? 1 : 0)));

  const labels: PasswordStrengthResult['label'][] = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const label = password.length === 0 ? 'Too weak' : labels[capped] ?? 'Too weak';
  const percent = password.length === 0 ? 0 : [0, 25, 50, 75, 100][capped] ?? 0;

  const validation = validateAccountPassword(password);

  return {
    score: capped,
    label,
    percent,
    checks,
    isAcceptable: validation.ok,
    rejectionReason: validation.reason,
  };
}

/** Stricter rules for new account passwords (set-password). */
export function validateAccountPassword(password: string): { ok: boolean; reason?: string } {
  const checks = {
    length: password.length >= MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  if (!checks.length) {
    return { ok: false, reason: `Password must be at least ${MIN_LENGTH} characters` };
  }
  if (!checks.uppercase) {
    return { ok: false, reason: 'Password must include an uppercase letter' };
  }
  if (!checks.lowercase) {
    return { ok: false, reason: 'Password must include a lowercase letter' };
  }
  if (!checks.number) {
    return { ok: false, reason: 'Password must include a number' };
  }
  if (!checks.special) {
    return { ok: false, reason: 'Password must include a special character (!@#$…)' };
  }

  const initial = process.env.TEAM_INITIAL_PASSWORD || 'Welcome@RukaPay2026';
  if (password === initial) {
    return { ok: false, reason: 'Choose a new password — not the temporary one from your administrator' };
  }

  if (DISALLOWED_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, reason: 'This password is too common. Choose a stronger one' };
  }

  return { ok: true };
}
