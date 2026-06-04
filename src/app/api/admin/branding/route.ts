import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function GET() {
  try {
    await requireAuth();
    const supabase = createServiceClient();
    const { data } = await supabase.from('branding_settings').select('*').limit(1).single();
    return NextResponse.json({ branding: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const supabase = createServiceClient();

    const { data: existing } = await supabase.from('branding_settings').select('id').limit(1).single();

    if (existing) {
      const { data, error } = await supabase
        .from('branding_settings')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ branding: data });
    }

    const { data, error } = await supabase.from('branding_settings').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json({ branding: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}
