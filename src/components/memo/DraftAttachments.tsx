'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Upload, Download, X } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
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

export function DraftAttachments({
  memoId,
  pendingFiles = [],
  onAddPending,
  onRemovePending,
}: {
  memoId?: string;
  pendingFiles?: File[];
  onAddPending?: (file: File) => void;
  onRemovePending?: (index: number) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

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

    if (!memoId) {
      onAddPending?.(file);
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      await uploadMemoAttachment(memoId, file);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const hasPending = pendingFiles.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold flex items-center gap-2 mb-3 text-sm">
        <Paperclip size={16} />
        Attachments
      </h3>
      {!memoId && !hasPending ? (
        <p className="text-xs text-slate-500 mb-3">
          Add supporting documents here. They upload when you save or submit the memo.
        </p>
      ) : null}

      {attachments.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
            >
              <span className="truncate max-w-[200px]">{a.file_name}</span>
              <a
                href={`/api/files/${a.file_path}`}
                className="text-brand-600 hover:underline flex items-center gap-1 shrink-0"
                download
              >
                <Download size={14} />
                Download
              </a>
            </li>
          ))}
        </ul>
      ) : memoId && !hasPending ? (
        <p className="text-xs text-slate-500 mb-3">No attachments yet.</p>
      ) : null}

      {hasPending ? (
        <ul className="space-y-2 mb-4">
          {pendingFiles.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-3 py-2 border border-amber-100"
            >
              <span className="truncate max-w-[200px]">{file.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-700">Queued</span>
                {onRemovePending ? (
                  <button
                    type="button"
                    onClick={() => onRemovePending(index)}
                    className="text-slate-400 hover:text-red-500 p-0.5"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="btn-secondary inline-flex items-center gap-2 text-sm cursor-pointer">
        <Upload size={14} />
        {uploading ? 'Uploading...' : 'Add attachment'}
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}
