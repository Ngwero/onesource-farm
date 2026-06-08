'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { normalizeUserProfile } from '@/lib/auth/profile';
import { canCreateMemo } from '@/lib/auth/rbac';
import type { RoleSlug, User } from '@/types';
import { Upload, CheckCircle } from 'lucide-react';
import { SignatureImage } from '@/components/memo/SignatureImage';
import { apiFetch } from '@/lib/api/client';

export default function SignaturePage() {
  const { user, setUserFromProfile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const roleSlug = user?.role?.slug as RoleSlug | undefined;
  const canAuthorMemos = canCreateMemo(roleSlug) || roleSlug === 'admin';

  useEffect(() => {
    if (user?.id) void refreshProfile();
  }, [user?.id, refreshProfile]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiFetch('/api/signatures', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const profile = normalizeUserProfile(data.user) || (data.user as User);
      if (profile) setUserFromProfile(profile);
      await refreshProfile();
      setSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload signature');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">My Signature</h1>
      <p className="text-slate-500 text-sm mb-6">
        {canAuthorMemos
          ? 'Optional — your signature appears under Prepared By on memos you author when uploaded.'
          : 'Optional — your signature is stamped on approval steps when uploaded.'}{' '}
        PNG or JPEG; light signatures are darkened automatically for printing.
      </p>

      <div className="card p-6">
        {(user as { signature_path?: string })?.signature_path ? (
          <div className="mb-4 p-4 border border-slate-200 rounded-lg bg-white">
            <p className="text-xs text-slate-500 mb-2">Preview (enhanced for print)</p>
            <SignatureImage
              src={`/api/files/${(user as { signature_path: string }).signature_path}`}
              className="max-h-16"
            />
          </div>
        ) : null}

        {(user as { signature_path?: string })?.signature_path || success ? (
          <div className="flex items-center gap-2 text-brand-600 mb-4">
            <CheckCircle size={20} />
            <span className="font-medium">Signature uploaded</span>
          </div>
        ) : (
          <div className="bg-slate-50 text-slate-600 text-sm p-3 rounded-lg mb-4">
            No signature on file yet. You can still create and approve memos; upload one here when you want it on the PDF.
          </div>
        )}

        <label className="btn-primary flex items-center gap-2 cursor-pointer w-fit">
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload Signature'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>

        <p className="text-xs text-slate-400 mt-4">
          Max 2MB. PNG with transparent background recommended.
        </p>
      </div>
    </div>
  );
}
