'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { canCreateMemo } from '@/lib/auth/rbac';
import { getUserRoleSlug } from '@/lib/auth/profile';
import type { RoleSlug } from '@/types';
import { MemoEditorForm } from '@/components/memo/MemoEditorForm';

export default function CreateMemoPage() {
  const { user, loading, refreshProfile } = useAuth();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setSessionReady(false);
      return;
    }
    let cancelled = false;
    void refreshProfile().then((profile) => {
      if (!cancelled) setSessionReady(Boolean(profile));
    });
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, refreshProfile]);

  if (loading || (user && !sessionReady)) {
    return <div className="text-center py-12 text-slate-500">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-lg">
        <h1 className="page-title mb-4">Create New Memo</h1>
        <p className="text-slate-600 mb-4">Your session expired. Sign in again to create a memo.</p>
        <Link href="/login" className="btn-primary text-sm">
          Go to login
        </Link>
      </div>
    );
  }

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
