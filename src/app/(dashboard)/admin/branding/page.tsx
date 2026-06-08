'use client';

import { useState, useEffect } from 'react';
import type { BrandingSettings } from '@/types';

export default function AdminBrandingPage() {
  const [branding, setBranding] = useState<Partial<BrandingSettings>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/branding', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBranding(d.branding || {}));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/admin/branding', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding),
    });
    setSaving(false);
    if (res.ok) setSaved(true);
  }

  const fields = [
    { key: 'company_name', label: 'Company Name' },
    { key: 'company_short_name', label: 'Short Name (RukaPay)' },
    { key: 'company_address', label: 'Company Address', textarea: true },
    { key: 'footer_text', label: 'Footer Text', textarea: true },
    { key: 'confidentiality_notice', label: 'Confidentiality Notice', textarea: true },
    { key: 'page_number_style', label: 'Page Number Style (use {current} and {total})' },
    {
      key: 'usd_to_ugx_rate',
      label: 'USD to UGX exchange rate',
      number: true,
      hint: 'Used when financial implication amounts are entered in USD (e.g. USD 500).',
    },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Branding Settings</h1>

      <form onSubmit={handleSave} className="card p-6 space-y-4">
        {fields.map(({ key, label, textarea, number, hint }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            {textarea ? (
              <textarea
                value={(branding as Record<string, string>)[key] || ''}
                onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                className="input-field min-h-[80px]"
              />
            ) : (
              <input
                type={number ? 'number' : 'text'}
                min={number ? 1 : undefined}
                step={number ? '0.01' : undefined}
                value={
                  number
                    ? (branding as Record<string, number | string>)[key] ?? ''
                    : (branding as Record<string, string>)[key] || ''
                }
                onChange={(e) =>
                  setBranding({
                    ...branding,
                    [key]: number ? parseFloat(e.target.value) || '' : e.target.value,
                  })
                }
                className="input-field"
              />
            )}
            {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
          </div>
        ))}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
        {saved && <p className="text-brand-600 text-sm">Settings saved successfully.</p>}
      </form>
    </div>
  );
}
