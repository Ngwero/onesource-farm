import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ departments: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('departments').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ department: data }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
