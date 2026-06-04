import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanViewMemo } from '@/lib/auth/memoAccess';
import { logAudit } from '@/lib/audit/logger';

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
      .from('comments')
      .select('*, user:users!user_id(full_name, title)')
      .eq('memo_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ comments: data || [] });
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
    await assertCanViewMemo(user, id);

    const { content } = await request.json();
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'Comment content required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('comments')
      .insert({
        memo_id: id,
        user_id: user.id,
        content: String(content).trim(),
      })
      .select('*, user:users!user_id(full_name, title)')
      .single();

    if (error) throw error;

    await logAudit({
      memoId: id,
      userId: user.id,
      action: 'comment_added',
      newValues: { content: String(content).trim().slice(0, 200) },
    });

    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
