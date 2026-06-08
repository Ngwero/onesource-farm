'use client';

import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canCreateMemo } from '@/lib/auth/rbac';
import { getUserRoleSlug } from '@/lib/auth/profile';
import type { RoleSlug } from '@/types';

const TABS = [
  { label: 'All', href: '/memos' },
  { label: 'My Drafts', href: '/memos?status=draft' },
  { label: 'In progress', href: '/memos?view=active' },
  { label: 'Returned', href: '/memos?status=returned' },
  { label: 'Approved', href: '/memos?status=approved', approverLabel: 'I approved' },
] as const;

function tabActive(fullPath: string, href: string): boolean {
  if (href === '/memos') return fullPath === '/memos';
  return fullPath === href;
}

export function MemosFilterTabs({
  fullPath,
  showApproverApprovedLabel = false,
  className = '',
}: {
  fullPath: string;
  showApproverApprovedLabel?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const roleSlug = getUserRoleSlug(user) as RoleSlug | undefined;
  const canCreate = Boolean(roleSlug && (canCreateMemo(roleSlug) || roleSlug === 'admin'));

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6${className ? ` ${className}` : ''}`}
    >
      <div className="filter-tabs">
        {TABS.map((tab) => {
          const active = tabActive(fullPath, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`filter-tab${active ? ' filter-tab--active' : ''}`}
            >
              {tab.label === 'Approved' && showApproverApprovedLabel && tab.approverLabel
                ? tab.approverLabel
                : tab.label}
            </Link>
          );
        })}
      </div>
      {canCreate ? (
        <Link href="/memos/create" className="btn-primary inline-flex items-center gap-2 text-sm shrink-0">
          <PlusCircle size={16} />
          New memo
        </Link>
      ) : null}
    </div>
  );
}
