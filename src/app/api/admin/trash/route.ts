import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('trash_records')
      .select(
        `
        *,
        memo:memos(id, reference_number, subject, deleted_at),
        deleted_by_user:users!deleted_by(full_name, email)
      `
      )
      .is('restored_at', null)
      .is('permanently_deleted_at', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { memo_id, action, reason } = await request.json();

    if (!memo_id || !action) {
      return NextResponse.json({ error: 'memo_id and action required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    if (action === 'restore') {
      const { data: draftStatus } = await supabase
        .from('memo_statuses')
        .select('id')
        .eq('slug', 'draft')
        .single();

      await supabase
        .from('memos')
        .update({
          status_id: draftStatus!.id,
          deleted_at: null,
        })
        .eq('id', memo_id);

      await supabase
        .from('trash_records')
        .update({
          restored_at: new Date().toISOString(),
          restored_by: admin.id,
        })
        .eq('memo_id', memo_id);

      await logAudit({
        memoId: memo_id,
        userId: admin.id,
        action: 'memo_restored',
      });

      return NextResponse.json({ success: true, action: 'restore' });
    }

    if (action === 'permanent_delete') {
      if (!reason) {
        return NextResponse.json({ error: 'Reason required for permanent deletion' }, { status: 400 });
      }

      await supabase
        .from('trash_records')
        .update({
          permanently_deleted_at: new Date().toISOString(),
          permanently_deleted_by: admin.id,
          delete_reason: reason,
        })
        .eq('memo_id', memo_id);

      await logAudit({
        memoId: memo_id,
        userId: admin.id,
        action: 'memo_permanently_deleted',
        newValues: { reason },
      });

      return NextResponse.json({ success: true, action: 'permanent_delete' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
