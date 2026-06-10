export type MemoReturnFeedback = {
  approverName: string;
  comments: string;
  signedAt?: string;
};

type ApprovalRow = {
  action: string;
  comments?: string | null;
  signed_at?: string | null;
  approver?: { full_name?: string } | { full_name?: string }[] | null;
};

function approverName(
  approver: ApprovalRow['approver']
): string | undefined {
  if (!approver) return undefined;
  if (Array.isArray(approver)) return approver[0]?.full_name;
  return approver.full_name;
}

/** Most recent return-for-correction note on a memo. */
export function getLatestReturnFeedback(
  approvals?: ApprovalRow[] | null
): MemoReturnFeedback | null {
  const returns = (approvals || [])
    .filter((row) => row.action === 'return')
    .sort(
      (a, b) =>
        new Date(b.signed_at || 0).getTime() - new Date(a.signed_at || 0).getTime()
    );

  const latest = returns[0];
  if (!latest) return null;

  return {
    approverName: approverName(latest.approver) || 'Approver',
    comments: latest.comments?.trim() || 'No comment provided.',
    signedAt: latest.signed_at || undefined,
  };
}
