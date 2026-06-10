'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { MemoEditorForm, type MemoFormState } from '@/components/memo/MemoEditorForm';
import { canEditMemo } from '@/lib/auth/rbac';
import { rowToMemoForAccess } from '@/lib/auth/memoRbacShape';
import { joinSlug } from '@/lib/auth/memoAccess';
import { apiFetch } from '@/lib/api/client';
import type { Memo } from '@/types';

export default function EditMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [initialForm, setInitialForm] = useState<Partial<MemoFormState> | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch(`/api/memos/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        const m = data.memo as Memo & {
          memo_statuses?: { slug: string } | { slug: string }[];
          memo_types?: { slug: string };
          departments?: { code: string; name?: string };
          approvals?: { action: string }[];
        };
        const memoForRbac = rowToMemoForAccess({
          id: m.id,
          creator_id: m.creator_id,
          department_id: m.department_id,
          requires_exco: m.requires_exco,
          requires_finance: m.requires_finance,
          memo_types: m.memo_types,
          memo_statuses: m.memo_statuses,
          departments: m.departments,
          creator: m.creator,
        });
        if (!canEditMemo(user, { ...memoForRbac, approvals: m.approvals })) {
          router.replace(`/memos/${id}`);
          return;
        }
        setMemo(m);
        setInitialForm({
          memo_type_id: m.memo_type_id,
          memo_from: m.memo_from || '',
          memo_thru: m.memo_thru || '',
          memo_to: m.memo_to || '',
          memo_date: m.memo_date || new Date().toISOString().split('T')[0],
          subject: m.subject || '',
          background: m.background || '',
          financial_implication: m.financial_implication || '',
          justification: m.justification || '',
          recommendation: m.recommendation || '',
          requires_finance: Boolean(m.requires_finance),
          importance_level: m.importance_level || 'normal',
        });
      })
      .catch(() => router.replace('/memos'))
      .finally(() => setLoading(false));
  }, [id, user, router]);

  if (!user || loading || !initialForm) {
    return <div className="text-center py-12 text-slate-500">Loading draft...</div>;
  }

  const statusSlug =
    joinSlug((memo as { memo_statuses?: { slug: string } | { slug: string }[] })?.memo_statuses) ||
    memo?.status?.slug;

  return (
    <div>
      <div className="mb-4">
        <Link href={`/memos/${id}`} className="text-sm text-brand-600 hover:underline">
          ← Back to memo preview
        </Link>
      </div>
      <MemoEditorForm
        mode="edit"
        memoId={id}
        referenceNumber={memo?.reference_number}
        initialForm={initialForm}
        statusSlug={statusSlug}
        approvals={(memo as { approvals?: { action: string }[] })?.approvals}
        user={{
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          title: user.title,
          department_id: user.department_id,
          department: user.department,
          role: user.role,
        }}
      />
    </div>
  );
}
