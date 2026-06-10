import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/logger';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanViewMemo } from '@/lib/auth/memoAccess';
import { deleteFile } from '@/lib/storage';
import { patchEditableMemo } from '@/lib/memo/updateDraft';
import { attachPendingAssigneeNames } from '@/lib/memo/pendingAssignee';
import { buildWorkflowTimelineForMemo } from '@/lib/memo/workflowTimeline';
import { buildMemoActivity } from '@/lib/memo/memoActivity';
import {
  repairAllStaleSignatureRecords,
  repairStaleSignatureRecordsForMemo,
} from '@/lib/signature/sync';

const MEMO_DETAIL_SELECT = `
  *,
  memo_types(name, slug),
  memo_statuses(name, slug),
  departments(name, code),
  creator:users!creator_id(id, full_name, email, title, signature_path),
  memo_attachments(*),
  approvals(*, approver:users!approver_id(full_name, title)),
  signature_records(*, approver:users!approver_id(signature_path)),
  exco_approvals(*, exco_member:exco_members(position))
`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await assertCanViewMemo(user, id);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('memos')
      .select(MEMO_DETAIL_SELECT)
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    await repairStaleSignatureRecordsForMemo(id);

    const { data: refreshed, error: refreshError } = await supabase
      .from('memos')
      .select(MEMO_DETAIL_SELECT)
      .eq('id', id)
      .single();
    if (refreshError || !refreshed) {
      return NextResponse.json({ error: refreshError?.message || 'Not found' }, { status: 404 });
    }

    const [memo] = await attachPendingAssigneeNames(supabase, [refreshed], user.id);
    const [workflow_timeline, activity] = await Promise.all([
      buildWorkflowTimelineForMemo(memo, user.id),
      buildMemoActivity(id),
    ]);

    after(async () => {
      try {
        await repairAllStaleSignatureRecords();
      } catch (err) {
        console.error('Global signature repair failed:', err);
      }
    });

    return NextResponse.json({ memo: { ...memo, workflow_timeline, activity } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Memo not found';
    const status = message === 'Forbidden' ? 403 : message === 'Memo not found' ? 404 : 500;
    if (status === 403 || status === 404) {
      return NextResponse.json({ error: message }, { status });
    }
    return authErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    await patchEditableMemo(user, id, body, body.change_reason as string | undefined);

    const supabase = createServiceClient();
    const { data, error } = await supabase.from('memos').select().eq('id', id).single();
    if (error) throw error;

    return NextResponse.json({ memo: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message === 'Forbidden' || message === 'Memo cannot be edited') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return authErrorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: memo } = await supabase
      .from('memos')
      .select('creator_id, memo_statuses(slug)')
      .eq('id', id)
      .single();

    if (!memo) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const statusRow = memo.memo_statuses as { slug: string } | { slug: string }[] | null;
    const statusSlug = Array.isArray(statusRow) ? statusRow[0]?.slug : statusRow?.slug;

    if (statusSlug === 'draft' && memo.creator_id === user.id) {
      const { data: attachments } = await supabase
        .from('memo_attachments')
        .select('file_path')
        .eq('memo_id', id);

      for (const att of attachments || []) {
        try {
          await deleteFile(att.file_path);
        } catch {
          /* file may already be missing */
        }
      }

      const { error: deleteError } = await supabase.from('memos').delete().eq('id', id);
      if (deleteError) throw deleteError;

      await logAudit({
        memoId: id,
        userId: user.id,
        action: 'memo_deleted',
        newValues: { hard_delete: true, draft: true },
      });

      return NextResponse.json({ success: true });
    }

    if (user.role?.slug !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    let reason = searchParams.get('reason') || 'Deleted by admin';
    try {
      const body = await request.json();
      if (body?.reason) reason = String(body.reason);
    } catch {
      /* no body */
    }

    const { data: deletedStatus } = await supabase
      .from('memo_statuses')
      .select('id')
      .eq('slug', 'deleted')
      .single();

    if (!deletedStatus) {
      return NextResponse.json({ error: 'Deleted status not configured' }, { status: 500 });
    }

    await supabase
      .from('memos')
      .update({ status_id: deletedStatus.id, deleted_at: new Date().toISOString() })
      .eq('id', id);

    await supabase.from('trash_records').upsert({
      memo_id: id,
      deleted_by: user.id,
      delete_reason: reason,
      deleted_at: new Date().toISOString(),
    });

    await logAudit({
      memoId: id,
      userId: user.id,
      action: 'memo_deleted',
      newValues: { reason },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
