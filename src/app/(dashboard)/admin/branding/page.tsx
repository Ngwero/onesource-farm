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
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Branding Settings</h1>

      <form onSubmit={handleSave} className="card p-6 space-y-4">
        {fields.map(({ key, label, textarea }) => (
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
                value={(branding as Record<string, string>)[key] || ''}
                onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                className="input-field"
              />
            )}
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
