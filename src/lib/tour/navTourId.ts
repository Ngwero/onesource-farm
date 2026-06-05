/** Stable data-tour-id for a sidebar link from its href and label. */
export function navTourId(href: string, label: string): string {
  const lower = label.toLowerCase();

  if (href.includes('/dashboard/')) return 'tour-dashboard';
  if (href === '/memos/create') return 'tour-create-memo';
  if (href === '/settings/signature' && lower.includes('upload signature')) {
    return 'tour-signature-upload';
  }
  if (href.includes('status=draft')) return 'tour-drafts';
  if (href.includes('view=active')) return 'tour-in-progress';
  if (href.includes('shared=1')) return 'tour-shared';
  if (href === '/notifications') return 'tour-notifications-page';
  if (href === '/settings/signature') return 'tour-signature';
  if (href === '/settings/delegation') return 'tour-delegation';
  if (href.includes('pending_') || lower.includes('pending')) return 'tour-pending';
  if (href.includes('status=approved') || lower.includes('i approved')) return 'tour-approved';
  if (href === '/memos') return 'tour-all-memos';
  if (href === '/admin/users') return 'tour-admin-users';
  if (href === '/admin/workflows') return 'tour-admin-workflows';
  if (href === '/admin/departments') return 'tour-admin-departments';
  if (href.startsWith('/admin/')) return 'tour-admin';
  if (href.includes('memo_type')) return 'tour-memo-type';

  return `tour-nav-${href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
}
