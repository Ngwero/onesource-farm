'use client';

import { useState } from 'react';
import { Paperclip, Download, Eye } from 'lucide-react';
import {
  detectDocumentKind,
  DocumentViewerModal,
  type DocumentViewerKind,
} from '@/components/shared/DocumentViewerModal';

export type MemoAttachmentItem = {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
};

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
    kind: DocumentViewerKind;
  } | null>(null);

  if (!showEmpty && attachments.length === 0) return null;

  return (
    <>
      <div className="card p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Paperclip size={16} />
          Files{attachments.length > 0 ? ` (${attachments.length})` : ''}
        </h3>

        {attachments.length > 0 ? (
          <ul className="space-y-2">
            {attachments.map((a) => {
              const kind = detectDocumentKind(a.mime_type, a.file_name);
              const url = fileUrl(a.file_path);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.file_name}</p>
                    {a.file_size ? (
                      <p className="text-xs text-slate-400">{formatSize(a.file_size)}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreview({ attachment: a, kind })}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <a
                      href={url}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
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
        ) : (
          <p className="text-sm text-slate-500">No files attached.</p>
        )}
      </div>

      <DocumentViewerModal
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.attachment.file_name ?? 'Document'}
        subtitle={preview?.attachment.file_size ? formatSize(preview.attachment.file_size) : undefined}
        src={preview ? fileUrl(preview.attachment.file_path) : null}
        kind={preview?.kind ?? 'other'}
        downloadHref={preview ? fileUrl(preview.attachment.file_path) : null}
        downloadName={preview?.attachment.file_name}
      />
    </>
  );
}
