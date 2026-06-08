'use client';

import { useState } from 'react';
import { Download, FileText, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';

type Props = {
  memoId: string;
  referenceNumber: string;
};

export function MemoDocumentExport({ memoId, referenceNumber }: Props) {
  const [exporting, setExporting] = useState(false);

  async function downloadPdf() {
    setExporting(true);
    try {
      const res = await apiFetch(`/api/memos/${memoId}/export?format=pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Export failed');
      }
      const blob = await res.blob();
      const filename = `${referenceNumber.replace(/\//g, '-')}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="memo-export-panel memo-export-panel--compact-mobile" aria-label="Export memo PDF">
      <div className="memo-export-panel__icon" aria-hidden>
        <FileText size={22} strokeWidth={1.75} />
      </div>
      <div className="memo-export-panel__copy">
        <p className="memo-export-panel__eyebrow">E-Copy export</p>
        <h2 className="memo-export-panel__title">Download official PDF</h2>
        <p className="memo-export-panel__desc">
          Watermarked electronic copy with E-COPY tag. Locked for viewing and printing — not
          editable in PDF software.
        </p>
        <p className="memo-export-panel__ref">
          <ShieldCheck size={14} aria-hidden />
          {referenceNumber}
        </p>
      </div>
      <button
        type="button"
        onClick={downloadPdf}
        disabled={exporting}
        className="memo-export-panel__btn btn-primary"
      >
        <Download size={18} aria-hidden />
        {exporting ? 'Preparing PDF…' : 'Download PDF'}
      </button>
    </section>
  );
}
