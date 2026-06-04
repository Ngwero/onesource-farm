import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanViewMemo } from '@/lib/auth/memoAccess';
import { hasPermission } from '@/lib/auth/rbac';
import type { RoleSlug } from '@/types';
import { logAudit } from '@/lib/audit/logger';
import { sendNotification, fetchMemoNotificationContext } from '@/lib/notifications/service';

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
      .from('shared_memo_access')
      .select('id, shared_with, can_comment, created_at, user:users!shared_with(id, full_name, email)')
      .eq('memo_id', id);

    if (error) throw error;
    return NextResponse.json({ shares: data || [] });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { email, can_comment } = await request.json();

    const supabase = createServiceClient();
    const { data: memo } = await supabase
      .from('memos')
      .select('creator_id, reference_number')
      .eq('id', id)
      .single();

    if (!memo) return NextResponse.json({ error: 'Memo not found' }, { status: 404 });

    const role = user.role?.slug as RoleSlug;
    const canShare =
      memo.creator_id === user.id ||
      hasPermission(role, '*') ||
      hasPermission(role, 'memo:share');

    if (!canShare) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { data: target } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'User not found with that email' }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 });
    }

    const { data: share, error } = await supabase
      .from('shared_memo_access')
      .upsert(
        {
          memo_id: id,
          shared_by: user.id,
          shared_with: target.id,
          can_comment: can_comment !== false,
        },
        { onConflict: 'memo_id,shared_with' }
      )
      .select('*, user:users!shared_with(full_name, email)')
      .single();

    if (error) throw error;

    const ctx = await fetchMemoNotificationContext(id);
    await sendNotification({
      userId: target.id,
      memoId: id,
      title: 'Memo shared with you',
      message: `${user.full_name} shared memo ${memo.reference_number} with you (view only).`,
      type: 'memo_shared',
      context: ctx,
    });

    await logAudit({
      memoId: id,
      userId: user.id,
      action: 'memo_shared',
      newValues: { shared_with: target.email },
    });

    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
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
    const { searchParams } = new URL(request.url);
    const sharedWith = searchParams.get('shared_with');

    if (!sharedWith) {
      return NextResponse.json({ error: 'shared_with required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: memo } = await supabase
      .from('memos')
      .select('creator_id')
      .eq('id', id)
      .single();

    if (!memo || (memo.creator_id !== user.id && user.role?.slug !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await supabase
      .from('shared_memo_access')
      .delete()
      .eq('memo_id', id)
      .eq('shared_with', sharedWith);

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
