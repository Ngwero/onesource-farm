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

function needsSignaturePathSync(
  storedPath: string | null | undefined,
  currentPath: string
): boolean {
  return isBlankSignaturePath(storedPath) || storedPath !== currentPath;
}

/** Point memo signature rows at the user's current upload (blank or stale paths). */
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

  const recordIds = (records || [])
    .filter((row) => needsSignaturePathSync(row.signature_path as string | null, signaturePath))
    .map((row) => row.id as string);

  if (recordIds.length > 0) {
    const { error } = await supabase
      .from('signature_records')
      .update({
        signature_path: signaturePath,
        ...(profile?.full_name ? { approver_name: profile.full_name } : {}),
        ...(profile?.title !== undefined ? { approver_title: profile.title } : {}),
      })
      .in('id', recordIds);
    if (error) throw error;
    updated += recordIds.length;
  }

  const { data: approvals } = await supabase
    .from('approvals')
    .select('id, signature_path')
    .eq('approver_id', userId);

  const approvalIds = (approvals || [])
    .filter((row) => needsSignaturePathSync(row.signature_path as string | null, signaturePath))
    .map((row) => row.id as string);

  if (approvalIds.length > 0) {
    const { error } = await supabase
      .from('approvals')
      .update({ signature_path: signaturePath })
      .in('id', approvalIds);
    if (error) throw error;
    updated += approvalIds.length;
  }

  return updated;
}

async function repairStaleSignatureRows(
  rows: Array<{
    id: string;
    signature_path: string | null;
    approver: { signature_path?: string | null } | null;
  }>
): Promise<number> {
  const supabase = createServiceClient();
  let updated = 0;

  for (const row of rows) {
    const currentPath = row.approver?.signature_path?.trim();
    if (!currentPath) continue;
    if (!needsSignaturePathSync(row.signature_path, currentPath)) continue;

    const { error } = await supabase
      .from('signature_records')
      .update({ signature_path: currentPath })
      .eq('id', row.id);
    if (error) throw error;
    updated += 1;
  }

  return updated;
}

/** Repair memo stamps that still reference an approver's old signature file. */
export async function repairStaleSignatureRecordsForMemo(memoId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data: records, error } = await supabase
    .from('signature_records')
    .select('id, signature_path, approver:users!approver_id(signature_path)')
    .eq('memo_id', memoId);

  if (error) throw error;
  return repairStaleSignatureRows(
    (records || []) as Array<{
      id: string;
      signature_path: string | null;
      approver: { signature_path?: string | null } | null;
    }>
  );
}

/** Repair stale or blank signature paths for every user who has a signature on file. */
export async function repairAllStaleSignatureRecords(): Promise<number> {
  const supabase = createServiceClient();

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, title, signature_path')
    .not('signature_path', 'is', null);

  if (error) throw error;

  let updated = 0;
  for (const user of users || []) {
    const signaturePath = (user.signature_path as string | null)?.trim();
    if (!signaturePath) continue;
    updated += await backfillBlankUserSignatures(user.id as string, signaturePath, {
      full_name: user.full_name as string,
      title: user.title as string | null | undefined,
    });
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
    if (!needsSignaturePathSync(existing.signature_path as string | null, creator.signature_path)) {
      return;
    }

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
