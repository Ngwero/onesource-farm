import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';

/** Active users for supervisor / manager pickers. */
export async function GET() {
  return withPermission(undefined, async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, title')
      .eq('is_active', true)
      .order('full_name');
    if (error) throw error;
    return NextResponse.json({ users: data ?? [] });
  });
}
