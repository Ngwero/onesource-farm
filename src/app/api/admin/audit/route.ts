import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const memoId = searchParams.get('memo_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const format = searchParams.get('format');

    const supabase = createServiceClient();
    let query = supabase
      .from('audit_logs')
      .select('*, user:users!user_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (memoId) query = query.eq('memo_id', memoId);

    const { data, error } = await query;
    if (error) throw error;

    const logs = data || [];

    if (format === 'csv') {
      const header = 'timestamp,user,action,memo_id,entity_type\n';
      const rows = logs
        .map((l) => {
          const user = l.user as { full_name?: string; email?: string } | null;
          const name = user?.full_name || user?.email || '';
          return `"${l.created_at}","${name.replace(/"/g, '""')}","${l.action}","${l.memo_id || ''}","${l.entity_type || ''}"`;
        })
        .join('\n');
      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="audit-trail.csv"',
        },
      });
    }

    return NextResponse.json({ logs });
  } catch (err) {
    return authErrorResponse(err);
  }
}
