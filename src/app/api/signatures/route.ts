import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { storeFile } from '@/lib/storage';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { backfillBlankUserSignatures } from '@/lib/signature/sync';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(
      'signatures',
      buffer,
      file.name.replace(/\.[^.]+$/, '.png'),
      'image/png',
      user.id
    );

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .update({
        signature_path: stored.relativePath,
        signature_uploaded_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*, roles(slug, name), departments(name, code)')
      .single();

    if (error) throw error;

    await backfillBlankUserSignatures(user.id, stored.relativePath, {
      full_name: data.full_name,
      title: data.title,
    });

    return NextResponse.json({ user: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('Signature upload failed:', err);
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return authErrorResponse(err);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
