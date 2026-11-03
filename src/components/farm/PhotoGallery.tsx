'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, FileText, Loader2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { farmKeys } from '@/hooks/farm';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtDateTime } from '@/lib/farm/format';
import type { AttachmentEntity } from '@/lib/farm/operations';
import type { AttachmentRow } from '@/lib/farm/types';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

type Props = {
  entityType: AttachmentEntity;
  entityId: string;
  canEdit: boolean;
  title?: string;
};

function readDeviceGps(): Promise<{ lat: number; lng: number; accuracy: number | null } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  });
}

export function PhotoGallery({ entityType, entityId, canEdit, title = 'Photos' }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [deleting, setDeleting] = useState<AttachmentRow | null>(null);
  const [attachGps, setAttachGps] = useState(true);
  const key = farmKeys.attachments(entityType, entityId);

  const files = useQuery({
    queryKey: key,
    queryFn: () =>
      farmFetch<{ attachments: AttachmentRow[] }>(
        `/api/farm/attachments?entity_type=${entityType}&entity_id=${entityId}`
      ).then((r) => r.attachments),
  });

  const remove = useActionMutation((id: string) => farmFetch(`/api/farm/attachments/${id}`, { method: 'DELETE' }), {
    success: 'File removed',
    invalidate: [key],
    onDone: () => setDeleting(null),
  });

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    setUploading(chosen.length);
    const gps = attachGps ? await readDeviceGps() : null;
    let ok = 0;
    for (const file of chosen) {
      const body = new FormData();
      body.set('file', file);
      body.set('entity_type', entityType);
      body.set('entity_id', entityId);
      if (gps) {
        body.set('captured_lat', String(gps.lat));
        body.set('captured_lng', String(gps.lng));
        body.set('captured_at', new Date().toISOString());
        body.set(
          'meta',
          JSON.stringify({
            accuracy_m: gps.accuracy,
            source: 'device_geolocation',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          })
        );
      }
      try {
        const res = await fetch('/api/farm/attachments', { method: 'POST', body, credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Upload failed (${res.status})`);
        }
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${errorMessage(err)}`);
      }
      setUploading((n) => n - 1);
    }
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    if (ok) {
      toast.success(
        ok === 1
          ? gps
            ? 'Photo uploaded with GPS'
            : 'File uploaded'
          : `${ok} files uploaded${gps ? ' with GPS' : ''}`
      );
    }
    if (ok && attachGps && !gps) {
      toast.message('Uploaded without GPS — location permission was unavailable');
    }
    await queryClient.invalidateQueries({ queryKey: key });
  }

  const items = files.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={attachGps}
                onChange={(e) => setAttachGps(e.target.checked)}
                className="rounded border-slate-300"
              />
              Tag GPS
            </label>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <Button variant="outline" size="sm" onClick={() => cameraRef.current?.click()} disabled={uploading > 0}>
              {uploading > 0 ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              Take photo
            </Button>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading > 0}>
              Upload
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {files.error ? (
          <p className="text-sm text-destructive">{errorMessage(files.error)}</p>
        ) : files.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No photos yet.
            {canEdit
              ? ' Take a field photo (camera) or upload evidence — GPS is tagged when permission allows.'
              : ''}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((a) => {
              const url = `/api/farm/attachments/${a.id}`;
              const isImage = a.mime_type?.startsWith('image/');
              const hasGps = a.captured_lat != null && a.captured_lng != null;
              return (
                <li key={a.id} className="group relative overflow-hidden rounded-lg border bg-muted/30">
                  <a href={url} target="_blank" rel="noreferrer" className="block aspect-square">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element -- authenticated API stream
                      <img src={url} alt={a.caption ?? a.file_name} className="size-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground">
                        <FileText className="size-8" />
                        <span className="line-clamp-2 break-all">{a.file_name}</span>
                      </span>
                    )}
                  </a>
                  <div className="border-t bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
                    <p>
                      {a.uploaded_by_user?.full_name ?? 'Unknown'} · {fmtDateTime(a.created_at)}
                    </p>
                    {hasGps ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-brand-700">
                        <MapPin className="size-3" />
                        {Number(a.captured_lat).toFixed(5)}, {Number(a.captured_lng).toFixed(5)}
                      </p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-1.5 right-1.5 size-7 opacity-90 sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => setDeleting(a)}
                      aria-label={`Remove ${a.file_name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remove this file?"
        description={deleting ? `${deleting.file_name} will be permanently deleted.` : ''}
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}
