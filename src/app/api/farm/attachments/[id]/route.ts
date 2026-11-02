import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError } from '@/lib/farm/http';
import { attachmentEntity } from '@/lib/farm/operations';
import { deleteFile, readFile } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

async function loadAttachment(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('attachments')
    .select('id, entity_type, entity_id, file_path, file_name, mime_type')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** Streams the file; access follows the view permission of the record it belongs to. */
export async function GET(_request: Request, { params }: Params) {
  return withPermission(undefined, async ({ can }) => {
    const { id } = await params;
    const attachment = await loadAttachment(id);
    if (!can(attachmentEntity(attachment.entity_type).view)) {
      throw new HttpError('You do not have permission to view this file.', 403);
    }
    let buffer: Buffer;
    try {
      buffer = await readFile(attachment.file_path);
    } catch {
      throw new HttpError('The file is missing from storage.', 404);
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.file_name)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withPermission(undefined, async ({ user, can }) => {
    const { id } = await params;
    const attachment = await loadAttachment(id);
    if (!can(attachmentEntity(attachment.entity_type).edit)) {
      throw new HttpError('You do not have permission to delete this file.', 403);
    }
    const supabase = createServiceClient();
    const { error } = await supabase.from('attachments').delete().eq('id', id);
    if (error) throw error;
    await deleteFile(attachment.file_path);
    await auditFarm(user.id, 'deleted', 'attachment', id, { old: attachment });
    return NextResponse.json({ ok: true });
  });
}
