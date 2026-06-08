import type { RoleSlug, Memo, User } from '@/types';
import {
  departmentHeadCanApproveMemo,
  departmentHeadCanViewMemo,
} from '@/lib/memo/itRouting';
import { isDesignatedItFirstChecker } from '@/lib/workflow/itCheckers';
import {
  designatedFinanceStepReviewerCanApprove,
  designatedFinanceStepReviewerCanView,
  isInterdeptFinanceReviewer,
} from '@/lib/memo/financeMemoRouting';
import { isDesignatedCfo } from '@/lib/memo/designatedUsers';
import {
  emailsMatch,
  isDesignatedCeo,
  isDesignatedDeptHead,
  isDesignatedItDeptHead,
} from '@/lib/memo/designatedUsers';
import {
  businessHeadCanApproveMemo,
  marketingDeptHeadCanApproveMemo,
  marketingDeptHeadCanViewMemo,
} from '@/lib/memo/marketingRouting';
import { isDesignatedItSecondChecker } from '@/lib/memo/itRouting';
import { userInMemoDepartment } from '@/lib/memo/orgVisibility';

export const ROLE_PERMISSIONS: Record<RoleSlug, string[]> = {
  admin: ['*'],
  staff: ['memo:create', 'memo:view_own', 'memo:edit_draft', 'memo:withdraw', 'memo:share'],
  department_head: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_department',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  business_head: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_department',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  it_checker_first: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_it',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  it_checker_second: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_it',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  finance_reviewer: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_finance',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  hr_reviewer: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_hr',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  ceo: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_ceo',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
  exco_member: [
    'memo:create',
    'memo:view_own',
    'memo:edit_draft',
    'memo:withdraw',
    'memo:share',
    'memo:view_exco',
    'memo:approve',
    'memo:return',
    'memo:reject',
    'memo:comment',
  ],
};

export function hasPermission(roleSlug: RoleSlug, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[roleSlug];
  return perms?.includes('*') || perms?.includes(permission) || false;
}

export function canCreateMemo(roleSlug: RoleSlug | undefined): boolean {
  if (!roleSlug) return false;
  return hasPermission(roleSlug, 'memo:create');
}

export function hasUploadedSignature(user: Pick<User, 'signature_path'> | null | undefined): boolean {
  return Boolean(user?.signature_path?.trim());
}

/** Roles that stamp memos (author or approver) and need a signature on file. */
export function roleRequiresSignatureOnFile(roleSlug: RoleSlug | undefined): boolean {
  if (!roleSlug) return false;
  return (
    canCreateMemo(roleSlug) ||
    hasPermission(roleSlug, 'memo:approve') ||
    hasPermission(roleSlug, '*')
  );
}

export function userRequiresSignatureOnFile(user: User | null | undefined): boolean {
  if (!user?.role?.slug) return false;
  return roleRequiresSignatureOnFile(user.role.slug as RoleSlug);
}

/** User may create memos (signature + staff / dept head / admin). */
export function canStartMemo(user: User | null | undefined): boolean {
  if (!user?.role?.slug) return false;
  if (!hasUploadedSignature(user)) return false;
  const role = user.role.slug as RoleSlug;
  return canCreateMemo(role) || hasPermission(role, '*');
}

export {
  canCreateMemoType,
  canCreateAnyMemo,
  filterCreatableMemoTypes,
  isDesignatedItDeptHead,
} from '@/lib/memo/designatedUsers';

export const SIGNATURE_REQUIRED_FOR_MEMO_MESSAGE =
  'Upload your signature under Settings → My Signature before you can create memos.';

export const SIGNATURE_REQUIRED_FOR_APPROVAL_MESSAGE =
  'Upload your signature under Settings → My Signature before you can approve memos.';

export function canViewMemo(user: User, memo: Memo, sharedWith?: string[]): boolean {
  const role = user.role?.slug as RoleSlug;
  if (!role) return false;

  if (role === 'admin') return true;
  if (memo.creator_id === user.id) return true;
  if (sharedWith?.includes(user.id)) return true;

  const statusSlug = memo.status?.slug || '';
  if (statusSlug === 'draft' || statusSlug === 'deleted') {
    return false;
  }

  if (userInMemoDepartment(user, memo)) {
    return true;
  }

  if (designatedFinanceStepReviewerCanView(user, memo)) return true;

  switch (role) {
    case 'department_head':
      if (memo.memo_type?.slug === 'marketing_request') {
        return marketingDeptHeadCanViewMemo(user, memo);
      }
      return departmentHeadCanViewMemo(user, memo);
    case 'business_head':
      return marketingDeptHeadCanViewMemo(user, memo);
    case 'it_checker_first':
    case 'it_checker_second':
      return (
        memo.memo_type?.slug === 'it_request' &&
        [
          'pending_it_checker_first',
          'pending_it_checker_second',
          'pending_it_review',
          'pending_finance',
          'pending_ceo',
          'approved',
        ].includes(memo.status?.slug || '')
      );
    case 'finance_reviewer':
      if (isDesignatedCfo(user)) {
        return (
          memo.memo_type?.slug === 'finance_request' &&
          ['pending_finance', 'pending_ceo', 'approved', 'submitted'].includes(
            memo.status?.slug || ''
          )
        );
      }
      return false;
    case 'hr_reviewer':
      return memo.memo_type?.slug === 'hr_request';
    case 'ceo':
    case 'exco_member':
      return (
        memo.requires_exco ||
        ['pending_ceo', 'pending_exco', 'approved', 'submitted'].includes(memo.status?.slug || '')
      );
    default:
      return false;
  }
}

export function canEditMemo(user: User, memo: Memo): boolean {
  const editableStatuses = ['draft', 'returned', 'rejected'];
  return (
    memo.creator_id === user.id &&
    editableStatuses.includes(memo.status?.slug || '')
  );
}

export function canApproveMemo(user: User, memo: Memo): boolean {
  const role = user.role?.slug as RoleSlug;
  if (!role) return false;

  if (designatedFinanceStepReviewerCanApprove(user, memo)) {
    return true;
  }

  if (role === 'staff') {
    return false;
  }

  const statusSlug = memo.status?.slug;

  if (role === 'admin') {
    if (
      isDesignatedItFirstChecker(user) &&
      memo.memo_type?.slug === 'it_request' &&
      statusSlug === 'pending_it_checker_first'
    ) {
      return true;
    }
  } else if (role === 'it_checker_first') {
    return (
      memo.memo_type?.slug === 'it_request' &&
      statusSlug === 'pending_it_checker_first' &&
      isDesignatedItFirstChecker(user)
    );
  }

  if (statusSlug === 'pending_department_head') {
    const deptCode = memo.department?.code;
    if (deptCode && isDesignatedDeptHead(user, deptCode)) {
      return true;
    }
    if (deptCode === 'IT' && isDesignatedItDeptHead(user)) {
      return true;
    }
  }

  const roleStatusMap: Partial<Record<RoleSlug, MemoStatusSlug[]>> = {
    department_head: ['pending_department_head'],
    business_head: ['pending_business_head'],
    it_checker_first: ['pending_it_checker_first'],
    it_checker_second: ['pending_it_checker_second'],
    finance_reviewer: ['pending_finance'],
    hr_reviewer: ['pending_hr'],
    ceo: ['pending_ceo'],
    exco_member: ['pending_exco'],
  };

  type MemoStatusSlug = string;
  if (!roleStatusMap[role]?.includes(statusSlug || '')) return false;

  if (role === 'department_head') {
    if (memo.memo_type?.slug === 'marketing_request') {
      return marketingDeptHeadCanApproveMemo(user, memo);
    }
    return departmentHeadCanApproveMemo(user, memo, memo.department?.code);
  }

  if (role === 'business_head') {
    return businessHeadCanApproveMemo(user, memo);
  }

  if (role === 'it_checker_second') {
    return (
      memo.memo_type?.slug === 'it_request' &&
      statusSlug === 'pending_it_checker_second' &&
      isDesignatedItSecondChecker(user)
    );
  }

  if (role === 'ceo') {
    return statusSlug === 'pending_ceo' && isDesignatedCeo(user);
  }

  if (role === 'hr_reviewer' || role === 'finance_reviewer') {
    return false;
  }

  return false;
}

export function canUploadAttachments(user: User, memo: Memo): boolean {
  return canEditMemo(user, memo);
}

export const DASHBOARD_ROUTES: Record<RoleSlug, string> = {
  admin: '/dashboard/admin',
  staff: '/dashboard/staff',
  department_head: '/dashboard/department-head',
  business_head: '/dashboard/department-head',
  it_checker_first: '/dashboard/it',
  it_checker_second: '/dashboard/it',
  finance_reviewer: '/dashboard/finance',
  hr_reviewer: '/dashboard/hr',
  ceo: '/dashboard/ceo',
  exco_member: '/dashboard/exco',
};

/** Home dashboard after login (Christine uses finance dashboard while role stays staff). */
export function resolveDashboardRoute(user: User | null | undefined): string {
  const roleSlug = user?.role?.slug as RoleSlug | undefined;
  if (!roleSlug) return '/dashboard/staff';
  if (roleSlug === 'staff' && isInterdeptFinanceReviewer(user)) {
    return '/dashboard/finance';
  }
  return DASHBOARD_ROUTES[roleSlug] || '/dashboard/staff';
}
