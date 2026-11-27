'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Upload, Download, Eye } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  detectDocumentKind,
  DocumentViewerModal,
  type DocumentViewerKind,
} from '@/components/shared/DocumentViewerModal';

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
};

export async function uploadMemoAttachment(memoId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch(`/api/memos/${memoId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
}

export async function uploadMemoAttachments(memoId: string, files: File[]): Promise<void> {
  for (const file of files) {
    await uploadMemoAttachment(memoId, file);
  }
}

function fileUrl(filePath: string) {
  return `/api/files/${filePath}`;
}

export function DraftAttachments({
  memoId,
  onEnsureMemoId,
}: {
  memoId?: string;
  onEnsureMemoId?: () => Promise<string>;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{
    attachment: Attachment;
    kind: DocumentViewerKind;
  } | null>(null);

  const load = useCallback(async () => {
    if (!memoId) {
      setAttachments([]);
      return;
    }
    const res = await apiFetch(`/api/memos/${memoId}`);
    const data = await res.json();
    if (res.ok) {
      setAttachments(data.memo?.memo_attachments || []);
    }
  }, [memoId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      let id = memoId;
      if (!id && onEnsureMemoId) {
        id = await onEnsureMemoId();
      }
      if (!id) {
        throw new Error('Save the memo draft first, or select a memo type and department.');
      }

      await uploadMemoAttachment(id, file);
      const res = await apiFetch(`/api/memos/${id}`);
      const data = await res.json();
      if (res.ok) {
        setAttachments(data.memo?.memo_attachments || []);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={16} />
          Files
        </h3>
        {!memoId ? (
          <p className="mb-3 text-xs text-slate-500">
            Choose memo type and department first. Files upload as soon as you add them.
          </p>
        ) : null}

        {attachments.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {attachments.map((a) => {
              const kind = detectDocumentKind(a.mime_type, a.file_name);
              const url = fileUrl(a.file_path);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{a.file_name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview({ attachment: a, kind })}
                      className="flex items-center gap-1 text-brand-600 hover:underline"
                      aria-label={`View ${a.file_name}`}
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <a
                      href={url}
                      className="flex items-center gap-1 text-brand-600 hover:underline"
                      download={a.file_name}
                    >
                      <Download size={14} />
                      Download
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : memoId ? (
          <p className="mb-3 text-xs text-slate-500">No files yet.</p>
        ) : null}

        <label className="btn-secondary inline-flex cursor-pointer items-center gap-2 text-sm">
          <Upload size={14} />
          {uploading ? 'Uploading…' : 'Add file'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <DocumentViewerModal
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.attachment.file_name ?? 'Document'}
        src={preview ? fileUrl(preview.attachment.file_path) : null}
        kind={preview?.kind ?? 'other'}
        downloadHref={preview ? fileUrl(preview.attachment.file_path) : null}
        downloadName={preview?.attachment.file_name}
      />
    </>
  );
}
