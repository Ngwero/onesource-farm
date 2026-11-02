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
  ChevronDown,
  Sprout,
  Map as MapIcon,
  LayoutGrid,
  Leaf,
  ShieldCheck,
  Award,
  Package,
  FileCheck,
  SlidersHorizontal,
  Tractor,
  Bug,
  HardHat,
  CalendarCheck,
  ListChecks,
  Wallet,
  Wheat,
  Boxes,
  ClipboardCheck,
  Ban,
  BadgeCheck,
  ClipboardList,
  Warehouse,
  History,
  GitBranch,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import type { Permission } from '@/lib/farm/permissions';
import { OneSourceLogo } from '@/components/brand/OneSourceLogo';
import { canCreateMemo } from '@/lib/auth/rbac';
import { isDesignatedItFirstChecker } from '@/lib/workflow/itCheckers';
import { isBusinessHead } from '@/lib/memo/marketingRouting';
import { isDesignatedCfo, isDesignatedChairman } from '@/lib/memo/designatedUsers';
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
    { label: 'My Memos', href: '/memos?view=mine', icon: <FileEdit size={18} /> },
    { label: 'My Drafts', href: '/memos?status=draft', icon: <FileText size={18} /> },
    { label: 'In progress', href: '/memos?view=active', icon: <FileText size={18} /> },
    { label: 'Shared with Me', href: '/memos?shared=1', icon: <Share2 size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
  ],
  business_head: [
    { label: 'Dashboard', href: '/dashboard/department-head', icon: <LayoutDashboard size={18} /> },
    { label: 'Create Memo', href: '/memos/create', icon: <PlusCircle size={18} /> },
    { label: 'My Memos', href: '/memos?view=mine', icon: <FileEdit size={18} /> },
    { label: 'My Drafts', href: '/memos?status=draft', icon: <FileEdit size={18} /> },
    {
      label: 'Pending business sign-off',
      href: '/memos?status=pending_business_head&memo_type=marketing_request',
      icon: <FileText size={18} />,
    },
    { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
    { label: 'Marketing memos', href: '/memos?memo_type=marketing_request', icon: <FileText size={18} /> },
    { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
    { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
    { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
  ],
  department_head: [
    { label: 'Dashboard', href: '/dashboard/department-head', icon: <LayoutDashboard size={18} /> },
    { label: 'Create Memo', href: '/memos/create', icon: <PlusCircle size={18} /> },
    { label: 'My Memos', href: '/memos?view=mine', icon: <FileEdit size={18} /> },
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
    {
      label: 'Pending dept head approval',
      href: '/memos?status=pending_department_head',
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

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

type FarmNavItem = NavItem & { permission: Permission; exact?: boolean };
type NavGroup = { id: string; label: string; icon: React.ReactNode; items: (NavItem & { exact?: boolean })[] };

const FARM_NAV_GROUPS: (Omit<NavGroup, 'items'> & { items: FarmNavItem[] })[] = [
  {
    id: 'farm',
    label: 'Farm',
    icon: <Sprout size={18} />,
    items: [
      { label: 'Farm Overview', href: '/farm', icon: <MapIcon size={18} />, permission: 'farm.view', exact: true },
      { label: 'Blocks', href: '/farm/blocks', icon: <LayoutGrid size={18} />, permission: 'farm.view' },
      { label: 'Crops', href: '/farm/crops', icon: <Leaf size={18} />, permission: 'crops.view' },
      { label: 'Activities', href: '/farm/activities', icon: <Tractor size={18} />, permission: 'activities.view' },
      { label: 'Pest & Disease', href: '/farm/incidents', icon: <Bug size={18} />, permission: 'pest.view' },
    ],
  },
  {
    id: 'workforce',
    label: 'Workforce',
    icon: <HardHat size={18} />,
    items: [
      { label: 'Workers', href: '/workforce/workers', icon: <Users size={18} />, permission: 'workforce.view' },
      { label: 'Attendance', href: '/workforce/attendance', icon: <CalendarCheck size={18} />, permission: 'attendance.record' },
      { label: 'Tasks', href: '/workforce/tasks', icon: <ListChecks size={18} />, permission: 'workforce.view' },
      { label: 'Payroll Costing', href: '/workforce/payroll', icon: <Wallet size={18} />, permission: 'payroll.view' },
    ],
  },
  {
    id: 'harvest',
    label: 'Harvest',
    icon: <Wheat size={18} />,
    items: [
      { label: 'Harvest Batches', href: '/harvest/batches', icon: <Boxes size={18} />, permission: 'harvest.view' },
      { label: 'Grading', href: '/harvest/grading', icon: <ClipboardCheck size={18} />, permission: 'harvest.view' },
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: <BadgeCheck size={18} />,
    items: [{ label: 'QC Inspections', href: '/quality/inspections', icon: <ClipboardList size={18} />, permission: 'qc.view' }],
  },
  {
    id: 'packhouse',
    label: 'Packhouse & Warehouse',
    icon: <Warehouse size={18} />,
    items: [
      { label: 'Packed Batches', href: '/packhouse/packing', icon: <Package size={18} />, permission: 'packing.view' },
      { label: 'Inventory', href: '/warehouse/inventory', icon: <Warehouse size={18} />, permission: 'warehouse.view' },
      { label: 'Stock Movements', href: '/warehouse/movements', icon: <History size={18} />, permission: 'warehouse.view' },
    ],
  },
  {
    id: 'trace',
    label: 'Traceability',
    icon: <GitBranch size={18} />,
    items: [{ label: 'Trace a Batch', href: '/trace', icon: <GitBranch size={18} />, permission: 'traceability.view' }],
  },
];

const FARM_ADMIN_GROUP: Omit<NavGroup, 'items'> & { items: FarmNavItem[] } = {
  id: 'farm-admin',
  label: 'Administration',
  icon: <Settings size={18} />,
  items: [
    { label: 'Access & Roles', href: '/admin/access', icon: <ShieldCheck size={18} />, permission: 'admin.users' },
    { label: 'Grades', href: '/admin/master/grades', icon: <Award size={18} />, permission: 'admin.settings' },
    { label: 'Activity Types', href: '/admin/master/activity-types', icon: <Tractor size={18} />, permission: 'admin.settings' },
    { label: 'Rejection Reasons', href: '/admin/master/rejection-reasons', icon: <Ban size={18} />, permission: 'admin.settings' },
    { label: 'Packaging', href: '/admin/master/packaging-types', icon: <Package size={18} />, permission: 'admin.settings' },
    { label: 'Warehouse Locations', href: '/admin/master/warehouse-locations', icon: <Warehouse size={18} />, permission: 'admin.settings' },
    { label: 'Document Types', href: '/admin/master/document-types', icon: <FileCheck size={18} />, permission: 'admin.settings' },
    { label: 'System Settings', href: '/admin/system-settings', icon: <SlidersHorizontal size={18} />, permission: 'admin.settings' },
  ],
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const access = useFarmAccess();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
    const myMemos: NavItem = {
      label: 'My Memos',
      href: '/memos?view=mine',
      icon: <FileEdit size={18} />,
    };
    if (!navItems.some((i) => i.href === myMemos.href)) {
      const createIdx = navItems.findIndex((i) => i.href === '/memos/create');
      const insertAt = createIdx >= 0 ? createIdx + 1 : 1;
      navItems = [...navItems.slice(0, insertAt), myMemos, ...navItems.slice(insertAt)];
    }
  }

  if (roleSlug === 'staff' && user && isInterdeptFinanceReviewer(user)) {
    navItems = navWithCreateMemo(
      [
        { label: 'Dashboard', href: '/dashboard/finance', icon: <LayoutDashboard size={18} /> },
        { label: 'My Memos', href: '/memos?view=mine', icon: <FileEdit size={18} /> },
        { label: 'Pending Finance', href: '/memos?status=pending_finance', icon: <FileText size={18} /> },
        { label: 'Awaiting payment',
          href: '/memos?status=approved&payment_status=not_paid',
          icon: <FileText size={18} />,
        },
        {
          label: 'Paid memos',
          href: '/memos?status=approved&payment_status=paid',
          icon: <FileText size={18} />,
        },
        { label: 'I approved', href: '/memos?status=approved', icon: <FileText size={18} /> },
        { label: 'Involving me', href: '/memos', icon: <Building2 size={18} /> },
        { label: 'Notifications', href: '/notifications', icon: <Bell size={18} /> },
        { label: 'My Signature', href: '/settings/signature', icon: <PenLine size={18} /> },
        { label: 'Delegation', href: '/settings/delegation', icon: <UserCog size={18} /> },
      ],
      roleSlug,
      user
    );
  }

  if (roleSlug === 'ceo' && user && isDesignatedChairman(user)) {
    const allMemos: NavItem = {
      label: 'All memos',
      href: '/memos',
      icon: <FileText size={18} />,
    };
    if (!navItems.some((i) => i.href === allMemos.href)) {
      const pendingIdx = navItems.findIndex((i) => i.href.includes('pending_ceo'));
      const insertAt = pendingIdx >= 0 ? pendingIdx + 1 : 1;
      navItems = [...navItems.slice(0, insertAt), allMemos, ...navItems.slice(insertAt)];
    }
  }

  if (user && isDesignatedCfo(user) && (roleSlug === 'finance_reviewer' || roleSlug === 'exco_member')) {
    const financePending: NavItem = {
      label: 'Pending Finance',
      href: '/memos?status=pending_finance',
      icon: <FileText size={18} />,
    };
    const allFinance: NavItem = {
      label: 'All finance memos',
      href: '/memos?view=involving',
      icon: <Building2 size={18} />,
    };
    if (!navItems.some((i) => i.href === financePending.href)) {
      const dashIdx = navItems.findIndex((i) => i.href.startsWith('/dashboard'));
      const insertAt = dashIdx >= 0 ? dashIdx + 1 : 1;
      navItems = [...navItems.slice(0, insertAt), financePending, allFinance, ...navItems.slice(insertAt)];
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
    access.roles[0]?.name ||
    user?.title?.trim() ||
    roleSlug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const dashboardItem = navItems.find((i) => i.href.startsWith('/dashboard'));
  const groups: NavGroup[] = [
    ...FARM_NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => access.can(i.permission)),
    })),
    {
      id: 'ememo',
      label: 'Requests',
      icon: <FileText size={18} />,
      items: navItems.filter((i) => i !== dashboardItem),
    },
    {
      ...FARM_ADMIN_GROUP,
      items: FARM_ADMIN_GROUP.items.filter((i) => access.can(i.permission)),
    },
  ].filter((g) => g.items.length > 0);

  const renderLink = (item: NavItem & { exact?: boolean }, nested = false) => {
    const active = item.exact ? pathname === item.href : isNavActive(pathname, fullPath, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        data-tour-id={navTourId(item.href, item.label)}
        className={`app-sidebar__link${nested ? ' app-sidebar__link--nested' : ''}${active ? ' app-sidebar__link--active' : ''}`}
        onClick={onClose}
      >
        <span className={active ? 'text-white' : 'text-white/55'}>{item.icon}</span>
        {item.label}
      </Link>
    );
  };

  return (
    <aside className={`app-sidebar${open ? ' app-sidebar--open' : ''}`}>
      <div className="app-sidebar__brand">
        <OneSourceLogo width={168} variant="full" priority centered />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 text-center mt-3">
          Farm to Export
        </p>
      </div>

      <div className="app-sidebar__user">
        <p className="text-sm font-semibold truncate">{user?.full_name}</p>
        <p className="text-[11px] text-white/55 mt-0.5">{roleLabel}</p>
      </div>

      <nav className="app-sidebar__nav" data-tour-id="tour-sidebar">
        {dashboardItem ? renderLink(dashboardItem) : null}
        {groups.map((group) => {
          const containsActive = group.items.some((i) =>
            'exact' in i && i.exact ? pathname === i.href : isNavActive(pathname, fullPath, i.href)
          );
          const expanded = openGroups[group.id] ?? (containsActive || group.id === 'farm');
          return (
            <div key={group.id} className="app-sidebar__group">
              <button
                type="button"
                className="app-sidebar__group-toggle"
                aria-expanded={expanded}
                onClick={() => setOpenGroups((s) => ({ ...s, [group.id]: !expanded }))}
              >
                <span className="text-white/55">{group.icon}</span>
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown size={16} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
              </button>
              {expanded ? <div className="app-sidebar__group-items">{group.items.map((i) => renderLink(i, true))}</div> : null}
            </div>
          );
        })}
      </nav>

      <div className="app-sidebar__footer">
        <button
          type="button"
          data-tour-id="tour-sign-out"
          onClick={() => {
            onClose?.();
            void logout();
          }}
          className="app-sidebar__link w-full"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
