'use client';

import { useState } from 'react';
import { Paperclip, Download, Eye, X } from 'lucide-react';

export type MemoAttachmentItem = {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
};

function isPreviewable(attachment: MemoAttachmentItem): 'image' | 'pdf' | null {
  const mime = attachment.mime_type?.toLowerCase() || '';
  const name = attachment.file_name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return null;
}

function fileUrl(filePath: string) {
  return `/api/files/${filePath}`;
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MemoAttachmentList({
  attachments,
  showEmpty = true,
}: {
  attachments: MemoAttachmentItem[];
  showEmpty?: boolean;
}) {
  const [preview, setPreview] = useState<{
    attachment: MemoAttachmentItem;
    kind: 'image' | 'pdf';
  } | null>(null);

  if (!showEmpty && attachments.length === 0) return null;

  return (
    <>
      <div className="card p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Paperclip size={16} />
          Attachments{attachments.length > 0 ? ` (${attachments.length})` : ''}
        </h3>

        {attachments.length > 0 ? (
          <ul className="space-y-2">
            {attachments.map((a) => {
              const previewKind = isPreviewable(a);
              const url = fileUrl(a.file_path);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{a.file_name}</p>
                    {a.file_size ? (
                      <p className="text-xs text-slate-400">{formatSize(a.file_size)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {previewKind ? (
                      <button
                        type="button"
                        onClick={() => setPreview({ attachment: a, kind: previewKind })}
                        className="text-brand-600 hover:underline flex items-center gap-1 text-xs"
                      >
                        <Eye size={14} />
                        Preview
                      </button>
                    ) : null}
                    <a
                      href={url}
                      className="text-brand-600 hover:underline flex items-center gap-1 text-xs"
                      download
                    >
                      <Download size={14} />
                      Download
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No attachments on this memo.</p>
        )}
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.attachment.file_name}`}
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
