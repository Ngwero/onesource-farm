import type { SignatureRecord } from '@/types';

export type SignatureBlockType = 'prepared' | 'checked' | 'reviewed' | 'approved';

export type MemoCreatorProfile = {
  id: string;
  full_name: string;
  title?: string | null;
  signature_path?: string | null;
};

type MemoForPrepared = {
  creator_id: string;
  creator?: MemoCreatorProfile | null;
  submitted_at?: string | null;
  created_at: string;
};

/** Prepared By is always the memo creator; other blocks use approval signature records. */
export function resolveSignatureForBlock(
  blockType: SignatureBlockType,
  signatures: SignatureRecord[],
  memo: MemoForPrepared
): SignatureRecord | null {
  if (blockType !== 'prepared') {
    return signatures.find((s) => s.block_type === blockType) ?? null;
  }

  const fromRecord = signatures.find((s) => s.block_type === 'prepared');
  if (fromRecord) return fromRecord;

  const creator = memo.creator;
  if (!creator || creator.id !== memo.creator_id) return null;

  return {
    id: `prepared-${memo.creator_id}`,
    memo_id: '',
    approver_id: creator.id,
    approver_name: creator.full_name,
    approver_title: creator.title ?? undefined,
    signature_path: creator.signature_path || '',
    block_type: 'prepared',
    signed_at: memo.submitted_at || memo.created_at,
  };
}
