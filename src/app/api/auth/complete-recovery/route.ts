import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** After Supabase password recovery, clear must_set_password on the profile. */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const admin = createServiceClient();
    const { error } = await admin
      .from('users')
      .update({ must_set_password: false })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Complete recovery error:', err);
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
  }
}
