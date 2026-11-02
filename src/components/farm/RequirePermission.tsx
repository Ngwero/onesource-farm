'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import type { Permission } from '@/lib/farm/permissions';

/**
 * Page guard: the API enforces permissions too; this keeps the UI from showing dead screens.
 * Pass several permissions to allow access with any one of them.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission | Permission[];
  children: React.ReactNode;
}) {
  const { can: canOne, isLoading, error } = useFarmAccess();
  const can = (p: Permission | Permission[]) => (Array.isArray(p) ? p.some(canOne) : canOne(p));

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <Loader2 className="size-6 animate-spin text-brand-600" />
        Loading…
      </div>
    );
  }

  if (error || !can(permission)) {
    return (
      <div className="empty-state card">
        <div className="empty-state__icon">
          <ShieldAlert size={24} />
        </div>
        <p className="empty-state__title">You don’t have access to this page</p>
        <p className="empty-state__desc">Ask a system administrator to assign you the right role.</p>
      </div>
    );
  }

  return <>{children}</>;
}
