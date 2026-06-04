'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  findPersonByDisplayLine,
  type MemoPersonLineStyle,
  type MemoPersonOption,
} from '@/lib/memo/personLine';

type PersonSelectFieldProps = {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  people: MemoPersonOption[];
  lineStyle: MemoPersonLineStyle;
  optional?: boolean;
  placeholder?: string;
};

export function PersonSelectField({
  id,
  label,
  hint,
  value,
  onChange,
  people,
  lineStyle,
  optional = false,
  placeholder,
}: PersonSelectFieldProps) {
  const matched = useMemo(() => findPersonByDisplayLine(people, value), [people, value]);

  const [mode, setMode] = useState<'directory' | 'custom'>(() =>
    value && !matched ? 'custom' : 'directory'
  );
  const [selectedId, setSelectedId] = useState(() => matched?.id ?? '');

  useEffect(() => {
    const m = findPersonByDisplayLine(people, value);
    if (!value) {
      setMode('directory');
      setSelectedId('');
      return;
    }
    if (m) {
      setMode('directory');
      setSelectedId(m.id);
    } else if (value) {
      setMode('custom');
      setSelectedId('');
    }
  }, [value, people]);

  function handleDirectoryChange(userId: string) {
    if (userId === '__custom__') {
      setMode('custom');
      setSelectedId('');
      onChange('');
      return;
    }
    if (!userId) {
      setSelectedId('');
      onChange('');
      return;
    }
    const person = people.find((p) => p.id === userId);
    if (person) {
      setMode('directory');
      setSelectedId(userId);
      onChange(person.displayLine);
    }
  }

  const defaultPlaceholder =
    lineStyle === 'from'
      ? 'Select sender from directory...'
      : 'Select person from directory...';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>

      <select
        id={id}
        value={mode === 'custom' ? '__custom__' : selectedId}
        onChange={(e) => handleDirectoryChange(e.target.value)}
        className="input-field mb-2"
      >
        {optional && <option value="">— None —</option>}
        {!optional && <option value="">{defaultPlaceholder}</option>}
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayLine}
            {p.email ? ` (${p.email})` : ''}
          </option>
        ))}
        <option value="__custom__">Other — enter manually</option>
      </select>

      {mode === 'custom' && (
        <input
          type="text"
          aria-label={`${label} (manual)`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field"
          placeholder={placeholder || 'Type name and role...'}
        />
      )}

      {mode === 'directory' && matched && (
        <p className="text-xs text-slate-500 mt-1">
          {matched.email}
          {matched.department ? ` · ${matched.department}` : ''}
        </p>
      )}

      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{hint}</p>
    </div>
  );
}
