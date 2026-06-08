'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canCreateMemo, canStartMemo, hasUploadedSignature } from '@/lib/auth/rbac';
import { getUserRoleSlug } from '@/lib/auth/profile';
import type { RoleSlug } from '@/types';
import { MemoEditorForm } from '@/components/memo/MemoEditorForm';
import { SignatureRequiredNotice } from '@/components/memo/SignatureRequiredNotice';

export default function CreateMemoPage() {
  const { user, loading, refreshProfile } = useAuth();

  useEffect(() => {
    if (!loading && user) void refreshProfile();
  }, [loading, user?.id, refreshProfile]);

  if (loading || !user) return null;

  const roleSlug = getUserRoleSlug(user);
  const mayCreate = roleSlug && (canCreateMemo(roleSlug as RoleSlug) || roleSlug === 'admin');

  if (!mayCreate) {
    return (
      <div>
        <h1 className="page-title mb-6">Create New Memo</h1>
        <p className="text-slate-600">Your account role cannot create memos. Contact your administrator.</p>
      </div>
    );
  }

  if (!hasUploadedSignature(user)) {
    return (
      <div>
        <h1 className="page-title mb-6">Create New Memo</h1>
        <p className="text-sm text-slate-500 mb-4">
          Signed in as <strong>{user.full_name}</strong>
          {user.role?.name ? ` · ${user.role.name}` : ''}
          {user.department?.name ? ` · ${user.department.name}` : ''}
        </p>
        <SignatureRequiredNotice />
      </div>
    );
  }

  if (!canStartMemo(user)) {
    return (
      <div>
        <h1 className="page-title mb-6">Create New Memo</h1>
        <p className="text-slate-600">Complete your account setup before creating memos.</p>
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
