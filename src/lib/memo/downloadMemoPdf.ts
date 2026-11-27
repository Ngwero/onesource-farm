import { apiFetch } from '@/lib/api/client';

export type MemoPdfBlob = {
  blob: Blob;
  url: string;
  filename: string;
};

export async function fetchMemoPdf(memoId: string, referenceNumber: string): Promise<MemoPdfBlob> {
  const res = await apiFetch(`/api/memos/${memoId}/export?format=pdf`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Could not open PDF');
  }
  const blob = await res.blob();
  const filename = `${referenceNumber.replace(/\//g, '-')}.pdf`;
  const url = URL.createObjectURL(blob);
  return { blob, url, filename };
}

export function triggerBlobDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadMemoPdf(memoId: string, referenceNumber: string): Promise<void> {
  const pdf = await fetchMemoPdf(memoId, referenceNumber);
  try {
    triggerBlobDownload(pdf.url, pdf.filename);
  } finally {
    URL.revokeObjectURL(pdf.url);
  }
}
