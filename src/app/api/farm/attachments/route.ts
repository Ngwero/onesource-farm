import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError } from '@/lib/farm/http';
import { attachmentEntity } from '@/lib/farm/operations';
import { storeFile } from '@/lib/storage';

const SELECT =
  'id, entity_type, entity_id, file_name, mime_type, size_bytes, caption, created_at, captured_lat, captured_lng, captured_at, meta, uploaded_by_user:users!attachments_uploaded_by_fkey(id, full_name)';

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
    const capturedLatRaw = String(form.get('captured_lat') ?? '').trim();
    const capturedLngRaw = String(form.get('captured_lng') ?? '').trim();
    const capturedAtRaw = String(form.get('captured_at') ?? '').trim();
    const metaRaw = String(form.get('meta') ?? '').trim();
    const captured_lat = capturedLatRaw ? Number(capturedLatRaw) : null;
    const captured_lng = capturedLngRaw ? Number(capturedLngRaw) : null;
    const captured_at = capturedAtRaw || (captured_lat != null ? new Date().toISOString() : null);
    if ((captured_lat == null) !== (captured_lng == null) ||
        (captured_lat != null && (!Number.isFinite(captured_lat) || Math.abs(captured_lat) > 90)) ||
        (captured_lng != null && (!Number.isFinite(captured_lng) || Math.abs(captured_lng) > 180))) {
      throw new HttpError('Provide valid latitude and longitude together.', 400);
    }
    if (captured_at && !Number.isFinite(Date.parse(captured_at))) {
      throw new HttpError('Invalid capture timestamp.', 400);
    }
    let meta: Record<string, unknown> = {};
    if (metaRaw) {
      try {
        meta = JSON.parse(metaRaw) as Record<string, unknown>;
      } catch {
        meta = { note: metaRaw };
      }
    }
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
        captured_lat: Number.isFinite(captured_lat) ? captured_lat : null,
        captured_lng: Number.isFinite(captured_lng) ? captured_lng : null,
        captured_at,
        meta,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    await auditFarm(user.id, 'created', 'attachment', data.id, {
      new: { entityType, entityId, file: stored.fileName, captured_lat, captured_lng },
    });
    return NextResponse.json({ attachment: data }, { status: 201 });
  });
}
