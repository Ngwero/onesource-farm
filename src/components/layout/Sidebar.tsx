'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  FileEdit,
  PlusCircle,
  Bell,
  Settings,
  Users,
  Building2,
  Workflow,
  Trash2,
  BarChart3,
  LogOut,
  PenLine,
  Share2,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RukaPayLogo } from '@/components/brand/RukaPayLogo';
import { canCreateMemo } from '@/lib/auth/rbac';
import { isDesignatedItFirstChecker } from '@/lib/workflow/itCheckers';
import { isBusinessHead } from '@/lib/memo/marketingRouting';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
import { isInterdeptFinanceReviewer } from '@/lib/memo/financeMemoRouting';
import type { User } from '@/types';
import type { RoleSlug } from '@/types';
import { navTourId } from '@/lib/tour/navTourId';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const CREATE_MEMO_NAV: NavItem = {
  label: 'Create Memo',
  href: '/memos/create',
  icon: <PlusCircle size={18} />,
};

const MY_DRAFTS_NAV: NavItem = {
  label: 'My Drafts',
  href: '/memos?status=draft',
  icon: <FileEdit size={18} />,
};

function navWithCreateMemo(items: NavItem[], roleSlug: RoleSlug, user: User | null): NavItem[] {
  if (!canCreateMemo(roleSlug) && roleSlug !== 'admin') return items;

  let nav = [...items];

  if (!nav.some((i) => i.href === '/memos/create')) {
    const dashIdx = nav.findIndex((i) => i.href.startsWith('/dashboard'));
    const insertAt = dashIdx >= 0 ? dashIdx + 1 : 0;
    nav = [...nav.slice(0, insertAt), CREATE_MEMO_NAV, ...nav.slice(insertAt)];
  }

  if (!nav.some((i) => i.href.includes('status=draft'))) {
    const createIdx = nav.findIndex((i) => i.href === '/memos/create');
    const insertAt = createIdx >= 0 ? createIdx + 1 : 1;
    nav = [...nav.slice(0, insertAt), MY_DRAFTS_NAV, ...nav.slice(insertAt)];
  }

  return nav;
}

const NAV_BY_ROLE: Record<RoleSlug, NavItem[]> = {
  staff: [
    { label: 'Dashboard', href: '/dashboard/staff', icon: <LayoutDashboard size={18} /> },
    { label: 'Create Memo', href: '/memos/create', icon: <PlusCircle size={18} /> },
    { label: 'My Drafts', href: '/memos?status=draft', icon: <FileText size={18} /> },
    { label: 'In progress', href: '/memos?view=active', icon: <FileText size={18} /> },
    { label: 'Shared with Me', href: '/memos?shared=1', icon: <Share2 size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
  ],
  business_head: [
    { label: 'Dashboard', href: '/dashboard/department-head', icon: <LayoutDashboard size={18} /> },
    {
      label: 'Pending business sign-off',
      href: '/memos?status=pending_business_head&memo_type=marketing_request',
      icon: <FileText size={18} />,
    },
    { label: 'Marketing memos', href: '/memos?memo_type=marketing_request', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  department_head: [
    { label: 'Dashboard', href: '/dashboard/department-head', icon: <LayoutDashboard size={18} /> },
    { label: 'Create Memo', href: '/memos/create', icon: <PlusCircle size={18} /> },
    { label: 'My Drafts', href: '/memos?status=draft', icon: <FileEdit size={18} /> },
    { label: 'Pending Approval', href: '/memos?status=pending_department_head', icon: <FileText size={18} /> },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'Department Memos', href: '/memos', icon: <Building2 size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  it_checker_first: [
    { label: 'Dashboard', href: '/dashboard/it', icon: <LayoutDashboard size={18} /> },
    {
      label: 'Pending my check',
      href: '/memos?status=pending_it_checker_first',
      icon: <FileText size={18} />,
    },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'IT Requests', href: '/memos?memo_type=it_request', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  it_checker_second: [
    { label: 'Dashboard', href: '/dashboard/it', icon: <LayoutDashboard size={18} /> },
    {
      label: 'Pending my check',
      href: '/memos?status=pending_it_checker_second',
      icon: <FileText size={18} />,
    },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'IT Requests', href: '/memos?memo_type=it_request', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  finance_reviewer: [
    { label: 'Dashboard', href: '/dashboard/finance', icon: <LayoutDashboard size={18} /> },
    { label: 'Pending Finance', href: '/memos?status=pending_finance', icon: <FileText size={18} /> },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  hr_reviewer: [
    { label: 'Dashboard', href: '/dashboard/hr', icon: <LayoutDashboard size={18} /> },
    { label: 'Pending HR', href: '/memos?status=pending_hr', icon: <FileText size={18} /> },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'Leave Requests', href: '/memos?memo_type=leave_request', icon: <FileText size={18} /> },
    { label: 'HR Requests', href: '/memos?memo_type=hr_request', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  ceo: [
    { label: 'Dashboard', href: '/dashboard/ceo', icon: <LayoutDashboard size={18} /> },
    { label: 'Pending CEO', href: '/memos?status=pending_ceo', icon: <FileText size={18} /> },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  exco_member: [
    { label: 'Dashboard', href: '/dashboard/exco', icon: <LayoutDashboard size={18} /> },
    { label: 'Pending EXCO', href: '/memos?status=pending_exco', icon: <FileText size={18} /> },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  admin: [
    { label: 'Dashboard', href: '/dashboard/admin', icon: <LayoutDashboard size={18} /> },
    { label: 'Create Memo', href: '/memos/create', icon: <PlusCircle size={18} /> },
    { label: 'My Drafts', href: '/memos?status=draft', icon: <FileEdit size={18} /> },
    { label: 'All Memos', href: '/memos', icon: <FileText size={18} /> },
    { label: 'Users', href: '/admin/users', icon: <Users size={18} /> },
    { label: 'Departments', href: '/admin/departments', icon: <Building2 size={18} /> },
    { label: 'Workflows', href: '/admin/workflows', icon: <Workflow size={18} /> },
    { label: 'Branding', href: '/admin/branding', icon: <Settings size={18} /> },
    { label: 'Audit Reports', href: '/admin/audit', icon: <BarChart3 size={18} /> },
    { label: 'Trash', href: '/admin/trash', icon: <Trash2 size={18} /> },
    { label: 'SLA Tracking', href: '/admin/sla', icon: <BarChart3 size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
  ],
};

function isNavActive(pathname: string, fullPath: string, href: string): boolean {
  if (href.includes('?')) return fullPath === href;
  if (href === '/memos') return pathname === '/memos' && !fullPath.includes('?');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const roleSlug = (user?.role?.slug || (user as { roles?: { slug: string } })?.roles?.slug || 'staff') as RoleSlug;
  let navItems = navWithCreateMemo(NAV_BY_ROLE[roleSlug] || NAV_BY_ROLE.staff, roleSlug, user);

  if (roleSlug === 'department_head' && user && isBusinessHead(user)) {
    const mktPending: NavItem = {
      label: 'Marketing — Pending my approval',
      href: '/memos?status=pending_business_head&memo_type=marketing_request',
      icon: <FileText size={18} />,
    };
    if (!navItems.some((i) => i.href === mktPending.href)) {
      const dashIdx = navItems.findIndex((i) => i.href === '/dashboard/department-head');
      const insertAt = dashIdx >= 0 ? dashIdx + 1 : 1;
      navItems = [...navItems.slice(0, insertAt), mktPending, ...navItems.slice(insertAt)];
    }
  }

  if (roleSlug === 'staff' && user && isInterdeptFinanceReviewer(user)) {
    navItems = navWithCreateMemo(
      [
        { label: 'Dashboard', href: '/dashboard/finance', icon: <LayoutDashboard size={18} /> },
        { label: 'Pending Finance', href: '/memos?status=pending_finance', icon: <FileText size={18} /> },
        { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
        { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
        { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
        { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
      ],
      roleSlug,
      user
    );
  }

  if (user && isDesignatedCfo(user) && (roleSlug === 'finance_reviewer' || roleSlug === 'exco_member')) {
    const financePending: NavItem = {
      label: 'Christine — Finance memos',
      href: '/memos?status=pending_finance&memo_type=finance_request',
      icon: <FileText size={18} />,
    };
    if (!navItems.some((i) => i.href === financePending.href)) {
      const dashIdx = navItems.findIndex((i) => i.href.startsWith('/dashboard'));
      const insertAt = dashIdx >= 0 ? dashIdx + 1 : 1;
      navItems = [...navItems.slice(0, insertAt), financePending, ...navItems.slice(insertAt)];
    }
  }

  if (roleSlug === 'admin' && isDesignatedItFirstChecker(user)) {
    const itPending: NavItem = {
      label: 'IT — Pending my check',
      href: '/memos?status=pending_it_checker_first&memo_type=it_request',
      icon: <FileText size={18} />,
    };
    if (!navItems.some((i) => i.href === itPending.href)) {
      const dashIdx = navItems.findIndex((i) => i.href === '/dashboard/admin');
      const insertAt = dashIdx >= 0 ? dashIdx + 1 : 1;
      navItems = [...navItems.slice(0, insertAt), itPending, ...navItems.slice(insertAt)];
    }
  }

  const query = searchParams.toString();
  const fullPath = query ? `${pathname}?${query}` : pathname;
  const roleLabel =
    user?.title?.trim() ||
    roleSlug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <RukaPayLogo width={188} variant="full" priority centered />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 text-center mt-3">
          e-Memo
        </p>
      </div>

      <div className="app-sidebar__user">
        <p className="text-sm font-semibold truncate">{user?.full_name}</p>
        <p className="text-[11px] text-white/55 mt-0.5">{roleLabel}</p>
      </div>

      <nav className="app-sidebar__nav" data-tour-id="tour-sidebar">
        {navItems.map((item) => {
          const active = isNavActive(pathname, fullPath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={navTourId(item.href, item.label)}
              className={`app-sidebar__link${active ? ' app-sidebar__link--active' : ''}`}
            >
              <span className={active ? 'text-white' : 'text-white/55'}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="app-sidebar__footer">
        <button
          type="button"
          data-tour-id="tour-sign-out"
          onClick={() => void logout()}
          className="app-sidebar__link w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
