'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  showStrength?: boolean;
  variant?: 'login' | 'default';
  labelExtra?: React.ReactNode;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  required,
  autoComplete,
  minLength,
  showStrength = false,
  variant = 'login',
  labelExtra,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputClass = variant === 'login' ? 'login-input password-input-field' : 'input-field password-input-field';

  return (
    <div className={variant === 'login' ? 'login-field' : ''}>
      {labelExtra ? (
        labelExtra
      ) : (
        <label htmlFor={id} className={variant === 'login' ? 'login-label' : 'block text-sm font-medium mb-1'}>
          {label}
        </label>
      )}
      <div className="password-input-wrap relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="password-input-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showStrength ? <PasswordStrengthMeter password={value} /> : null}
    </div>
  );
}
