'use client';

import { useState, useEffect, useCallback } from 'react';
import { Paperclip, Upload, Download, Trash2 } from 'lucide-react';
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
  onEnsureMemoId,
}: {
  memoId?: string;
  onEnsureMemoId?: () => Promise<string>;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function handleDelete(attachmentId: string) {
    if (!memoId) return;
    if (!confirm('Remove this attachment?')) return;

    setDeletingId(attachmentId);
    try {
      const res = await apiFetch(`/api/memos/${memoId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

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
              className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-slate-100"
            >
              <span className="truncate max-w-[200px]">{a.file_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/files/${a.file_path}`}
                  className="text-brand-600 hover:underline flex items-center gap-1"
                  download
                >
                  <Download size={14} />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
                  aria-label={`Remove ${a.file_name}`}
                >
                  <Trash2 size={14} />
                  {deletingId === a.id ? 'Removing…' : 'Remove'}
                </button>
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
  );
}
