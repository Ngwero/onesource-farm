import {
  canCreateMemo,
  canStartMemo,
  hasUploadedSignature,
  userRequiresSignatureOnFile,
} from '@/lib/auth/rbac';
import type { RoleSlug, User } from '@/types';

export interface TourStep {
  id: string;
  /** data-tour-id on a DOM element; omit for centered cards */
  target?: string;
  title: string;
  body: string;
  placement?: 'right' | 'bottom' | 'left';
}

function authorSteps(user: User | null): TourStep[] {
  const steps: TourStep[] = [];

  if (userRequiresSignatureOnFile(user) && !hasUploadedSignature(user)) {
    steps.push({
      id: 'signature-upload',
      target: 'tour-signature-upload',
      title: 'Upload your signature first',
      body: 'Before you create memos, upload a PNG or JPEG signature here. It appears under Prepared By on memos you author.',
      placement: 'right',
    });
  } else if (userRequiresSignatureOnFile(user)) {
    steps.push({
      id: 'signature',
      target: 'tour-signature',
      title: 'My Signature',
      body: 'View or replace your signature anytime. Approvers also need a signature on file before they can approve memos.',
      placement: 'right',
    });
  }

  if (canStartMemo(user)) {
    steps.push({
      id: 'create-memo',
      target: 'tour-create-memo',
      title: 'Create Memo',
      body: 'Start a new internal memo — payment, procurement, leave, IT, marketing, and more. Save as draft until you are ready to submit.',
      placement: 'right',
    });
    steps.push({
      id: 'drafts',
      target: 'tour-drafts',
      title: 'My Drafts',
      body: 'Memos you have started but not submitted yet. Edit, attach files, and submit when complete.',
      placement: 'right',
    });
    steps.push({
      id: 'in-progress',
      target: 'tour-in-progress',
      title: 'In progress',
      body: 'Track memos you submitted that are still moving through the approval workflow.',
      placement: 'right',
    });
    steps.push({
      id: 'shared',
      target: 'tour-shared',
      title: 'Shared with Me',
      body: 'Memos colleagues shared with you for visibility — read and comment where allowed.',
      placement: 'right',
    });
  }

  return steps;
}

function approverSteps(roleSlug: RoleSlug): TourStep[] {
  const steps: TourStep[] = [
    {
      id: 'pending',
      target: 'tour-pending',
      title: 'Your approval queue',
      body: 'Memos waiting for your action appear here. Open one, review details, add comments, then approve, return, or reject.',
      placement: 'right',
    },
    {
      id: 'signature-approver',
      target: 'tour-signature',
      title: 'My Signature',
      body: 'Upload your signature before approving. It is stamped on each approval step you complete.',
      placement: 'right',
    },
    {
      id: 'approved',
      target: 'tour-approved',
      title: 'I approved',
      body: 'A history of memos you have already signed off on.',
      placement: 'right',
    },
    {
      id: 'delegation',
      target: 'tour-delegation',
      title: 'Delegation',
      body: 'Going away? Delegate your approval rights to a colleague for a set period.',
      placement: 'right',
    },
  ];

  if (roleSlug === 'admin') {
    return [
      {
        id: 'admin-users',
        target: 'tour-admin-users',
        title: 'Users',
        body: 'Add colleagues, assign departments and roles, and reset logins for onboarding.',
        placement: 'right',
      },
      {
        id: 'admin-workflows',
        target: 'tour-admin-workflows',
        title: 'Workflows',
        body: 'See how memo types route through departments, IT, Finance, HR, and CEO approval.',
        placement: 'right',
      },
      ...steps,
    ];
  }

  return steps;
}

export function buildTourSteps(user: User | null, roleSlug: RoleSlug): TourStep[] {
  const roleName = user?.role?.name || 'Team member';
  const isAuthor = canCreateMemo(roleSlug) || roleSlug === 'admin';
  const isApprover = [
    'department_head',
    'business_head',
    'it_checker_first',
    'it_checker_second',
    'finance_reviewer',
    'hr_reviewer',
    'ceo',
    'exco_member',
    'admin',
  ].includes(roleSlug);

  const steps: TourStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to RukaPay e-Memo',
      body: `Hi ${user?.full_name?.split(' ')[0] || 'there'} — this short tour walks you through the buttons you will use as <strong>${roleName}</strong>. You can skip anytime or replay it from the help button in the top bar.`,
    },
    {
      id: 'sidebar',
      target: 'tour-sidebar',
      title: 'Main menu',
      body: 'All navigation lives in this sidebar. Your options depend on your role — authors create memos, approvers review queues, admins manage the system.',
      placement: 'right',
    },
    {
      id: 'dashboard',
      target: 'tour-dashboard',
      title: 'Dashboard',
      body: 'Your home screen — summary counts, quick links, and recent memos relevant to you.',
      placement: 'right',
    },
  ];

  if (isAuthor) steps.push(...authorSteps(user));
  if (isApprover) steps.push(...approverSteps(roleSlug));

  steps.push(
    {
      id: 'search',
      target: 'tour-search',
      title: 'Search memos',
      body: 'Find memos by reference number, subject, or keyword across everything you can access.',
      placement: 'bottom',
    },
    {
      id: 'notifications',
      target: 'tour-notifications',
      title: 'Notifications',
      body: 'Bell icon for new assignments, returns, and approvals. Click View all for the full list.',
      placement: 'bottom',
    },
    {
      id: 'sign-out',
      target: 'tour-sign-out',
      title: 'Sign out',
      body: 'Use Sign Out at the bottom of the menu when you are done.',
      placement: 'right',
    },
    {
      id: 'finish',
      title: 'You are ready',
      body: 'That is the essentials. Upload your signature if you have not yet, then create or review your first memo. Need this again? Click <strong>Take tour</strong> in the top bar.',
    }
  );

  return steps;
}

export function resolveVisibleSteps(steps: TourStep[]): TourStep[] {
  if (typeof document === 'undefined') return steps;

  return steps.filter((step) => {
    if (!step.target) return true;
    return Boolean(document.querySelector(`[data-tour-id="${step.target}"]`));
  });
}
