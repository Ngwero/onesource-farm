import { createServiceClient } from '@/lib/supabase/server';
import { nowIso } from '@/lib/memo/actionTimestamps';

type UserSignatureProfile = {
  id: string;
  full_name: string;
  title?: string | null;
  signature_path: string;
};

function isBlankSignaturePath(path: string | null | undefined): boolean {
  return !path?.trim();
}

/** Fill signature_path on memo records where this user signed without an image on file. */
export async function backfillBlankUserSignatures(
  userId: string,
  signaturePath: string,
  profile?: Pick<UserSignatureProfile, 'full_name' | 'title'>
): Promise<number> {
  const supabase = createServiceClient();
  let updated = 0;

  const { data: records } = await supabase
    .from('signature_records')
    .select('id, signature_path')
    .eq('approver_id', userId);

  const blankRecordIds = (records || [])
    .filter((row) => isBlankSignaturePath(row.signature_path as string | null))
    .map((row) => row.id as string);

  if (blankRecordIds.length > 0) {
    const { error } = await supabase
      .from('signature_records')
      .update({
        signature_path: signaturePath,
        ...(profile?.full_name ? { approver_name: profile.full_name } : {}),
        ...(profile?.title !== undefined ? { approver_title: profile.title } : {}),
      })
      .in('id', blankRecordIds);
    if (error) throw error;
    updated += blankRecordIds.length;
  }

  const { data: approvals } = await supabase
    .from('approvals')
    .select('id, signature_path')
    .eq('approver_id', userId);

  const blankApprovalIds = (approvals || [])
    .filter((row) => isBlankSignaturePath(row.signature_path as string | null))
    .map((row) => row.id as string);

  if (blankApprovalIds.length > 0) {
    const { error } = await supabase
      .from('approvals')
      .update({ signature_path: signaturePath })
      .in('id', blankApprovalIds);
    if (error) throw error;
    updated += blankApprovalIds.length;
  }

  return updated;
}

/** Ensure the creator's Prepared By block has a signature when one is now on file. */
export async function syncPreparedSignatureIfBlank(
  memoId: string,
  creator: UserSignatureProfile,
  stampedAt = nowIso()
): Promise<void> {
  if (isBlankSignaturePath(creator.signature_path)) return;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('signature_records')
    .select('id, signature_path')
    .eq('memo_id', memoId)
    .eq('block_type', 'prepared')
    .maybeSingle();

  if (existing) {
    if (!isBlankSignaturePath(existing.signature_path as string | null)) return;

    const { error } = await supabase
      .from('signature_records')
      .update({
        signature_path: creator.signature_path,
        approver_name: creator.full_name,
        approver_title: creator.title,
        signed_at: stampedAt,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('signature_records').insert({
    memo_id: memoId,
    approver_id: creator.id,
    approver_name: creator.full_name,
    approver_title: creator.title,
    signature_path: creator.signature_path,
    block_type: 'prepared',
    signed_at: stampedAt,
  });
  if (error) throw error;
}
