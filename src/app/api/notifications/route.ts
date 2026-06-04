import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const unreadOnly = searchParams.get('unread') === '1';

    const supabase = createServiceClient();
    let query = supabase
      .from('notifications')
      .select('id, user_id, memo_id, title, message, type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) throw error;

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return NextResponse.json(
      { notifications: data || [], unread_count: unreadCount ?? 0 },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const supabase = createServiceClient();

    if (body.mark_all) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      return NextResponse.json({ success: true });
    }

    const ids = body.notification_ids as string[] | undefined;
    if (!ids?.length) {
      return NextResponse.json({ error: 'notification_ids or mark_all required' }, { status: 400 });
    }

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
