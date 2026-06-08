import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { deleteFile } from '@/lib/storage';
import { logAudit } from '@/lib/audit/logger';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanUploadAttachments } from '@/lib/auth/memoAccess';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: memoId, attachmentId } = await params;
    await assertCanUploadAttachments(user, memoId);

    const supabase = createServiceClient();
    const { data: attachment, error: fetchError } = await supabase
      .from('memo_attachments')
      .select('id, file_name, file_path, memo_id')
      .eq('id', attachmentId)
      .eq('memo_id', memoId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    try {
      await deleteFile(attachment.file_path);
    } catch {
      /* file may already be missing */
    }

    const { error: deleteError } = await supabase
      .from('memo_attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) throw deleteError;

    await logAudit({
      memoId,
      userId: user.id,
      action: 'attachment_deleted',
      newValues: { file_name: attachment.file_name },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    if (message === 'Forbidden' || message === 'Attachments locked') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return authErrorResponse(err);
  }
}
