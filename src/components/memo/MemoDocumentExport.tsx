'use client';

import { useEffect, useState } from 'react';
import { Eye, FileText, ShieldCheck } from 'lucide-react';
import { DocumentViewerModal } from '@/components/shared/DocumentViewerModal';
import { fetchMemoPdf, triggerBlobDownload } from '@/lib/memo/downloadMemoPdf';

type Props = {
  memoId: string;
  referenceNumber: string;
};

export function MemoDocumentExport({ memoId, referenceNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState(`${referenceNumber.replace(/\//g, '-')}.pdf`);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function openDocument() {
    setOpen(true);
    setLoading(true);
    setError(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    try {
      const pdf = await fetchMemoPdf(memoId, referenceNumber);
      setPdfUrl(pdf.url);
      setFilename(pdf.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open document');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setError(null);
    }
  }

  async function handleDownload() {
    if (!pdfUrl) return;
    setDownloading(true);
    try {
      triggerBlobDownload(pdfUrl, filename);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <section className="memo-export-panel memo-export-panel--compact-mobile" aria-label="Official memo document">
        <div className="memo-export-panel__icon" aria-hidden>
          <FileText size={22} strokeWidth={1.75} />
        </div>
        <div className="memo-export-panel__copy">
          <p className="memo-export-panel__eyebrow">Official document</p>
          <h2 className="memo-export-panel__title">View or download PDF</h2>
          <p className="memo-export-panel__desc">
            Opens in a preview window. Use Download to save a watermarked copy to your device.
          </p>
          <p className="memo-export-panel__ref">
            <ShieldCheck size={14} aria-hidden />
            {referenceNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openDocument()}
          className="memo-export-panel__btn btn-primary"
        >
          <Eye size={18} aria-hidden />
          View document
        </button>
      </section>

      <DocumentViewerModal
        open={open}
        onOpenChange={handleOpenChange}
        title={filename}
        subtitle={referenceNumber}
        src={pdfUrl}
        kind="pdf"
        loading={loading}
        error={error}
        onDownload={handleDownload}
        downloading={downloading}
      />
    </>
  );
}
