import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError } from '@/lib/farm/http';
import { attachmentEntity } from '@/lib/farm/operations';
import { storeFile } from '@/lib/storage';

const SELECT = 'id, entity_type, entity_id, file_name, mime_type, size_bytes, caption, created_at, uploaded_by_user:users!attachments_uploaded_by_fkey(id, full_name)';

export async function GET(request: Request) {
  return withPermission(undefined, async ({ can }) => {
    const url = new URL(request.url);
    const entityType = url.searchParams.get('entity_type');
    const entityId = url.searchParams.get('entity_id');
    const entity = attachmentEntity(entityType);
    if (!can(entity.view)) throw new HttpError('You do not have permission to view these files.', 403);
    if (!entityId) throw new HttpError('entity_id is required', 400);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('attachments')
      .select(SELECT)
      .eq('entity_type', entityType!)
      .eq('entity_id', entityId)
      .order('created_at');
    if (error) throw error;
    return NextResponse.json({ attachments: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission(undefined, async ({ user, can }) => {
    const form = await request.formData().catch(() => {
      throw new HttpError('Upload must be multipart form data', 400);
    });
    const entityType = String(form.get('entity_type') ?? '');
    const entityId = String(form.get('entity_id') ?? '');
    const caption = String(form.get('caption') ?? '').trim() || null;
    const file = form.get('file');
    const entity = attachmentEntity(entityType);
    if (!can(entity.edit)) throw new HttpError('You do not have permission to add files here.', 403);
    if (!(file instanceof File) || file.size === 0) throw new HttpError('Choose a file to upload', 400);

    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const { data: owner, error: ownerError } = await supabase
      .from(entity.table)
      .select('id')
      .eq('id', entityId)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!owner) throw new HttpError('The record this file belongs to was not found.', 404);

    let stored;
    try {
      stored = await storeFile(
        'attachments',
        Buffer.from(await file.arrayBuffer()),
        file.name,
        file.type,
        `farm/${entityType}`
      );
    } catch (err) {
      throw new HttpError(err instanceof Error ? err.message : 'Upload failed', 400);
    }

    const { data, error } = await supabase
      .from('attachments')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        file_path: stored.relativePath,
        file_name: stored.fileName,
        mime_type: stored.mimeType,
        size_bytes: stored.fileSize,
        caption,
        uploaded_by: user.id,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'attachment', data.id, { new: { entityType, entityId, file: stored.fileName } });
    return NextResponse.json({ attachment: data }, { status: 201 });
  });
}
