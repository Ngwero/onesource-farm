import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { storeFile } from '@/lib/storage';
import { enhanceSignatureBuffer } from '@/lib/signature/enhance';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const buffer = await enhanceSignatureBuffer(raw);
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
    return NextResponse.json({ user: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}
