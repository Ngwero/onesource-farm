'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canCreateMemo } from '@/lib/auth/rbac';
import { getUserRoleSlug } from '@/lib/auth/profile';
import type { RoleSlug } from '@/types';
import { MemoEditorForm } from '@/components/memo/MemoEditorForm';

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
