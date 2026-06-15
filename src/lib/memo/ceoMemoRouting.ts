import {
  isCeoMemoCreator,
  isDesignatedChairman,
  isDesignatedCeo,
} from '@/lib/memo/designatedUsers';
import type { Memo, User } from '@/types';

type MemoWithCreator = Memo & {
  creator?: { email?: string | null } | null;
};

function creatorEmailForMemo(memo: MemoWithCreator): string | undefined {
  return memo.creator?.email ?? undefined;
}

/** Douglas approves memos authored by Rowena at the CEO step. */
export function designatedChairmanCanApprove(user: User, memo: MemoWithCreator): boolean {
  if (memo.status?.slug !== 'pending_ceo') return false;
  if (!isDesignatedChairman(user)) return false;
  return isCeoMemoCreator({ email: creatorEmailForMemo(memo) });
}

/** Rowena approves everyone else's memos at the CEO step (not her own). */
export function designatedCeoCanApprove(user: User, memo: MemoWithCreator): boolean {
  if (memo.status?.slug !== 'pending_ceo') return false;
  if (!isDesignatedCeo(user)) return false;
  return !isCeoMemoCreator({ email: creatorEmailForMemo(memo) });
}

/** Chairman may view any memo in the system (except others' drafts and deleted memos). */
export function chairmanCanViewMemo(user: User, memo: MemoWithCreator): boolean {
  if (!isDesignatedChairman(user)) return false;
  const statusSlug = memo.status?.slug || '';
  if (statusSlug === 'deleted') return false;
  if (statusSlug === 'draft') return memo.creator_id === user.id;
  return true;
}
