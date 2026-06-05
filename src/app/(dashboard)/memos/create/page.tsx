'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canCreateMemo, hasUploadedSignature } from '@/lib/auth/rbac';
import type { RoleSlug } from '@/types';
import { MemoEditorForm } from '@/components/memo/MemoEditorForm';
import { SignatureRequiredNotice } from '@/components/memo/SignatureRequiredNotice';

export default function CreateMemoPage() {
  const { user, loading, refreshProfile } = useAuth();

  useEffect(() => {
    if (!loading && user) void refreshProfile();
  }, [loading, user?.id, refreshProfile]);

  if (loading || !user) return null;

  const roleSlug = user.role?.slug as RoleSlug | undefined;
  const mayCreateRole = canCreateMemo(roleSlug) || roleSlug === 'admin';

  if (!mayCreateRole) {
    return (
      <div>
        <h1 className="page-title mb-6">Create New Memo</h1>
        <p className="text-slate-600">Your role cannot create memos.</p>
      </div>
    );
  }

  if (!hasUploadedSignature(user)) {
    return (
      <div>
        <h1 className="page-title mb-6">Create New Memo</h1>
        <SignatureRequiredNotice />
      </div>
    );
  }

  return (
    <MemoEditorForm
      mode="create"
      user={{
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        title: user.title,
        department_id: user.department_id,
        department: user.department
          ? { name: user.department.name, code: user.department.code }
          : undefined,
        role: user.role,
      }}
    />
  );
}
