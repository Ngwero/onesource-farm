import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { storeFile } from '@/lib/storage';
import { logAudit } from '@/lib/audit/logger';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanUploadAttachments } from '@/lib/auth/memoAccess';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: memoId } = await params;
    await assertCanUploadAttachments(user, memoId);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: memo } = await supabase
      .from('memos')
      .select('current_version')
      .eq('id', memoId)
      .single();

    if (!memo) return NextResponse.json({ error: 'Memo not found' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile('attachments', buffer, file.name, file.type, memoId);

    const { data: attachment, error } = await supabase
      .from('memo_attachments')
      .insert({
        memo_id: memoId,
        version_number: memo.current_version,
        file_name: stored.fileName,
        file_path: stored.relativePath,
        file_size: stored.fileSize,
        mime_type: stored.mimeType,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      memoId,
      userId: user.id,
      action: 'attachment_uploaded',
      newValues: { file_name: stored.fileName },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    if (message === 'Forbidden' || message === 'Attachments locked') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return authErrorResponse(err);
  }
}
