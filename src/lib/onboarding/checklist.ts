import {
  canCreateMemo,
  hasUploadedSignature,
  userRequiresSignatureOnFile,
} from '@/lib/auth/rbac';
import { isInterdeptFinanceReviewer } from '@/lib/memo/financeMemoRouting';
import { isDesignatedItFirstChecker } from '@/lib/workflow/itCheckers';
import type { MemoStatusSlug, RoleSlug, User } from '@/types';

const ROLE_QUEUE_STATUS: Partial<Record<RoleSlug, MemoStatusSlug>> = {
  department_head: 'pending_department_head',
  business_head: 'pending_business_head',
  it_checker_first: 'pending_it_checker_first',
  it_checker_second: 'pending_it_checker_second',
  finance_reviewer: 'pending_finance',
  hr_reviewer: 'pending_hr',
  ceo: 'pending_ceo',
  exco_member: 'pending_exco',
};

function defaultStatusForRole(role: RoleSlug): MemoStatusSlug | undefined {
  return ROLE_QUEUE_STATUS[role];
}

const QUEUE_VISITED_KEY = 'ememo_onboarding_queue_visited';

export type OnboardingItem = {
  id: string;
  label: string;
  done: boolean;
  href?: string;
  hint?: string;
};

export function onboardingQueueHref(user: User): string {
  const role = user.role?.slug as RoleSlug | undefined;
  if (!role) return '/memos';

  if (role === 'staff' && isInterdeptFinanceReviewer(user)) {
    return '/memos?status=pending_finance';
  }

  const pending = defaultStatusForRole(role);
  if (pending) return `/memos?status=${pending}`;

  if (canCreateMemo(role)) return '/memos?view=active';

  if (role === 'admin' && isDesignatedItFirstChecker(user)) {
    return '/memos?status=pending_it_checker_first&memo_type=it_request';
  }

  if (role === 'admin') return '/memos';

  return '/memos';
}

export function onboardingQueueLabel(user: User): string {
  const role = user.role?.slug as RoleSlug | undefined;
  if (!role) return 'Open your memo list';

  if (role === 'admin' && isDesignatedItFirstChecker(user)) {
    return 'Open your IT check queue';
  }

  if (defaultStatusForRole(role)) return 'Open your approval queue';
  if (canCreateMemo(role)) return 'See memos in progress';
  return 'Browse memos';
}

export function markOnboardingQueueVisited(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${QUEUE_VISITED_KEY}:${userId}`, '1');
  } catch {
    /* ignore */
  }
}

export function hasVisitedOnboardingQueue(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`${QUEUE_VISITED_KEY}:${userId}`) === '1';
  } catch {
    return false;
  }
}

export function buildOnboardingItems(
  user: User,
  queueVisited: boolean
): OnboardingItem[] {
  const role = user.role?.slug as RoleSlug | undefined;
  const needsSignature = userRequiresSignatureOnFile(user);
  const signatureDone = !needsSignature || hasUploadedSignature(user);
  const departmentDone = Boolean(user.department_id && user.department?.name);

  const items: OnboardingItem[] = [];

  if (needsSignature) {
    items.push({
      id: 'signature',
      label: 'Upload your signature',
      done: signatureDone,
      href: '/settings/signature',
      hint: 'Required before you create or approve memos.',
    });
  }

  items.push({
    id: 'department',
    label: departmentDone
      ? `Department: ${user.department?.name}`
      : 'Confirm your department',
    done: departmentDone,
    href: undefined,
    hint: departmentDone
      ? 'Your memos are scoped to this department.'
      : 'Ask an admin to assign your department if it is missing.',
  });

  items.push({
    id: 'queue',
    label: onboardingQueueLabel(user),
    done: queueVisited,
    href: onboardingQueueHref(user),
    hint: role === 'admin' ? 'Review memos and pending approvals.' : undefined,
  });

  return items;
}

export function isOnboardingComplete(items: OnboardingItem[]): boolean {
  return items.length > 0 && items.every((item) => item.done);
}
