'use client';

import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type DocumentViewerKind = 'image' | 'pdf' | 'other';

type DocumentViewerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Blob or authenticated URL to show in the modal. */
  src: string | null;
  kind: DocumentViewerKind;
  loading?: boolean;
  error?: string | null;
  /** Optional filename hint under the title. */
  subtitle?: string;
  /** Preferred: trigger a controlled download (e.g. blob). */
  onDownload?: () => void | Promise<void>;
  /** Fallback: anchor download when onDownload is omitted. */
  downloadHref?: string | null;
  downloadName?: string;
  downloading?: boolean;
};

export function detectDocumentKind(mimeType?: string | null, fileName?: string | null): DocumentViewerKind {
  const mime = mimeType?.toLowerCase() || '';
  const name = fileName?.toLowerCase() || '';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) return 'image';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'other';
}

/** Shared document viewer: open in a modal, download from the modal. */
export function DocumentViewerModal({
  open,
  onOpenChange,
  title,
  src,
  kind,
  loading,
  error,
  subtitle,
  onDownload,
  downloadHref,
  downloadName,
  downloading,
}: DocumentViewerModalProps) {
  const canDownload = Boolean(onDownload || downloadHref);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92dvh,56rem)] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="gap-1 border-b border-border/70 px-4 py-3 pr-12 text-left sm:px-5">
          <DialogTitle className="truncate text-base sm:text-lg">{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription className="truncate text-xs sm:text-sm">{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Document preview</DialogDescription>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-3 sm:p-4">
          {loading ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-brand-600" />
              Preparing document…
            </div>
          ) : error ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center">
              <FileText className="size-8 text-slate-400" />
              <p className="text-sm font-medium text-foreground">Could not open document</p>
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          ) : kind === 'image' && src ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated / blob URLs
            <img src={src} alt={title} className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg object-contain" />
          ) : kind === 'pdf' && src ? (
            <iframe
              src={src}
              title={title}
              className="h-[min(70vh,42rem)] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center">
              <FileText className="size-8 text-slate-400" />
              <p className="text-sm font-medium text-foreground">Preview not available</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                This file type cannot be shown here. Use Download to save it to your device.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-between sm:px-5">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canDownload ? (
            onDownload ? (
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={loading || downloading || Boolean(error)}
                onClick={() => void onDownload()}
              >
                {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {downloading ? 'Downloading…' : 'Download'}
              </Button>
            ) : (
              <Button asChild className="w-full sm:w-auto" disabled={loading || Boolean(error)}>
                <a href={downloadHref!} download={downloadName || true}>
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
