import { apiFetch } from '@/lib/api/client';

export async function downloadMemoPdf(memoId: string, referenceNumber: string): Promise<void> {
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
}
