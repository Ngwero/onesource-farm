'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Upload, Download, Eye, X } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

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

function isPreviewable(attachment: Attachment): 'image' | 'pdf' | null {
  const mime = attachment.mime_type?.toLowerCase() || '';
  const name = attachment.file_name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return null;
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
    kind: 'image' | 'pdf';
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

  function handleView(attachment: Attachment) {
    const kind = isPreviewable(attachment);
    if (kind) {
      setPreview({ attachment, kind });
      return;
    }
    window.open(fileUrl(attachment.file_path), '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
          <Paperclip size={16} />
          Attachments
        </h3>
        {!memoId ? (
          <p className="text-xs text-slate-500 mb-3">
            Select a memo type and department first. Files upload immediately when added.
          </p>
        ) : null}

        {attachments.length > 0 ? (
          <ul className="space-y-2 mb-4">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
              >
                <span className="truncate min-w-0 flex-1">{a.file_name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleView(a)}
                    className="text-brand-600 hover:underline flex items-center gap-1"
                    aria-label={`View ${a.file_name}`}
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <a
                    href={fileUrl(a.file_path)}
                    className="text-brand-600 hover:underline flex items-center gap-1"
                    download
                  >
                    <Download size={14} />
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : memoId ? (
          <p className="text-xs text-slate-500 mb-3">No attachments yet.</p>
        ) : null}

        <label className="btn-secondary inline-flex items-center gap-2 text-sm cursor-pointer">
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Add attachment'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`View ${preview.attachment.file_name}`}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
              <p className="font-medium text-sm truncate">{preview.attachment.file_name}</p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              {preview.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl(preview.attachment.file_path)}
                  alt={preview.attachment.file_name}
                  className="max-w-full h-auto mx-auto rounded-lg"
                />
              ) : (
                <iframe
                  src={fileUrl(preview.attachment.file_path)}
                  title={preview.attachment.file_name}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
