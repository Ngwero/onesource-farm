import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { department_id, role_id, title, full_name, is_active } = body;

    const updates: Record<string, unknown> = {};
    if (department_id !== undefined) updates.department_id = department_id || null;
    if (role_id !== undefined) updates.role_id = role_id;
    if (title !== undefined) updates.title = title;
    if (full_name !== undefined) updates.full_name = full_name;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('*, roles(name, slug), departments(name, code)')
      .single();

    if (error) throw error;
    return NextResponse.json({ user: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}
