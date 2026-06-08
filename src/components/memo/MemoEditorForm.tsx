'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, Info, Trash2 } from 'lucide-react';
import { PersonSelectField } from '@/components/memo/PersonSelectField';
import { DraftAttachments } from '@/components/memo/DraftAttachments';
import { apiFetch } from '@/lib/api/client';
import { memoFromLineForUser, getPeopleForStyle, type MemoPersonOption } from '@/lib/memo/personLine';
import { memoAwaitingFirstApprover } from '@/lib/auth/rbac';
import { isFinanceRequestCreator } from '@/lib/workflow/financeWorkflowSteps';
import type { MemoStatusSlug, MemoTypeSlug } from '@/types';

export type MemoFormState = {
  memo_type_id: string;
  memo_from: string;
  memo_thru: string;
  memo_to: string;
  memo_date: string;
  subject: string;
  background: string;
  financial_implication: string;
  justification: string;
  recommendation: string;
  requires_finance: boolean;
  importance_level: string;
};

interface LookupData {
  memo_types: { id: string; name: string; slug: string }[];
  departments?: { id: string; name: string; code: string }[];
  people?: { from: MemoPersonOption[]; routing: MemoPersonOption[] };
}

const WORKFLOW_HINTS: Record<MemoTypeSlug, string> = {
  payment_request: 'Route: You → Department Head → Finance → CEO',
  procurement_request: 'Route: You → Department Head → Finance → CEO',
  hr_request: 'Route: You → Christine (finance) → CEO',
  leave_request: 'Route: You → Department Head → CEO',
  it_request:
    'Route: You → Department Head → Emmanuel (1st IT check) → Jim (2nd IT check) → CEO. Check “Budget involved” if Finance must review.',
  marketing_request: 'Route: Norman (Business) → Christine → CEO',
  finance_request: 'Route: You → Christine (finance) → CEO',
  general_internal:
    'Route: You → Department Head → Finance Review → CEO or EXCO (set importance level below)',
};

const FIELDS = {
  memo_from: {
    label: 'From',
    hint: 'Filled automatically from your account (name and department).',
  },
  memo_thru: {
    label: 'Thru',
    placeholder: 'e.g. Department Head — Sarah Dept Head (optional)',
    hint: 'Optional. Select from the staff directory.',
  },
  memo_to: {
    label: 'To',
    placeholder: 'e.g. CEO — David CEO',
    hint: 'Primary recipient from the staff directory.',
  },
  subject: {
    label: 'Subject',
    placeholder: 'e.g. Request for approval of Q2 marketing budget',
    hint: 'Short, specific title.',
  },
  background: {
    label: 'Background',
    placeholder: 'Describe the context and why this memo is needed...',
    hint: 'Explain the situation clearly for approvers.',
  },
  financial_implication: {
    label: 'Financial implication',
    placeholder: 'Amounts in UGX, budget line, payment method...',
    hint: 'Include figures or write “N/A”.',
  },
  justification: {
    label: 'Justification',
    placeholder: 'Why this request is necessary...',
    hint: 'Business case and risk of not acting.',
  },
  recommendation: {
    label: 'Recommendation',
    placeholder: 'What you want approvers to approve or do...',
    hint: 'Be specific about the requested action.',
  },
} as const;

function FieldHint({ text }: { text: string }) {
  return <p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p>;
}

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

type MemoEditorFormProps = {
  mode: 'create' | 'edit';
  memoId?: string;
  referenceNumber?: string;
  initialForm?: Partial<MemoFormState>;
  statusSlug?: string;
  approvals?: { action: string }[];
  user: {
    id: string;
    email: string;
    full_name: string;
    title?: string;
    department_id?: string;
    department?: { name: string; code?: string };
    role?: { name: string; slug: string };
  };
};

export function MemoEditorForm({
  mode,
  memoId,
  referenceNumber,
  initialForm,
  statusSlug,
  approvals,
  user,
}: MemoEditorFormProps) {
  const router = useRouter();
  const [lookup, setLookup] = useState<LookupData | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [targetDepartmentId, setTargetDepartmentId] = useState(user.department_id || '');
  const [loading, setLoading] = useState(false);
  const [draftMemoId, setDraftMemoId] = useState<string | undefined>();
  const effectiveMemoId = memoId ?? draftMemoId;
  const [form, setForm] = useState<MemoFormState>({
    memo_type_id: '',
    memo_from: '',
    memo_thru: '',
    memo_to: '',
    memo_date: new Date().toISOString().split('T')[0],
    subject: '',
    background: '',
    financial_implication: '',
    justification: '',
    recommendation: '',
    requires_finance: false,
    importance_level: 'normal',
    ...initialForm,
  });

  useEffect(() => {
    let cancelled = false;
    setLookupLoading(true);
    setLookupError(null);

    apiFetch('/api/lookup')
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setLookup(null);
          setLookupError(
            (data as { error?: string }).error ||
              (r.status === 401
                ? 'Your session expired. Log out and sign in again.'
                : 'Could not load memo form data.')
          );
          return;
        }
        setLookup(data as LookupData);
      })
      .catch(() => {
        if (!cancelled) {
          setLookup(null);
          setLookupError('Could not load memo form data. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const senderLine = useMemo(
    () =>
      memoFromLineForUser({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        title: user.title,
        department: user.department,
      }),
    [user]
  );

  useEffect(() => {
    setForm((f) => (f.memo_from === senderLine ? f : { ...f, memo_from: senderLine }));
  }, [senderLine]);

  const selectedType = lookup?.memo_types.find((t) => t.id === form.memo_type_id);
  const typeSlug = selectedType?.slug as MemoTypeSlug | undefined;
  const showFinance = typeSlug === 'it_request';

  useEffect(() => {
    if (typeSlug === 'it_request' && !form.requires_finance) {
      setForm((f) => ({ ...f, requires_finance: true }));
    }
  }, [typeSlug, form.requires_finance]);
  const peopleRouting = lookup?.people ? getPeopleForStyle(lookup.people, 'routing') : [];

  const workflowHint = useMemo(() => {
    if (!typeSlug) return undefined;
    if (typeSlug === 'finance_request' && isFinanceRequestCreator(user)) {
      return 'Route: You → Amara (CFO) → CEO';
    }
    return WORKFLOW_HINTS[typeSlug];
  }, [typeSlug, user]);

  async function ensureDraftMemo(): Promise<string> {
    if (memoId) return memoId;
    if (draftMemoId) return draftMemoId;
    if (!targetDepartmentId) {
      throw new Error('Select which department this memo is for before attaching files.');
    }
    if (!form.memo_type_id) {
      throw new Error('Select a memo type before attaching files.');
    }

    const res = await apiFetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department_id: targetDepartmentId,
        ...form,
        memo_from: senderLine,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const id = data.memo.id as string;
    setDraftMemoId(id);
    return id;
  }

  async function persist(submit: boolean) {
    if (!targetDepartmentId) {
      alert('Select which department this memo is for.');
      return;
    }
    if (!form.memo_type_id || !form.subject.trim()) {
      alert('Memo type and subject are required.');
      return;
    }

    setLoading(true);
    try {
      let id = effectiveMemoId;

      if (!id) {
        const res = await apiFetch('/api/memos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            department_id: targetDepartmentId,
            ...form,
            memo_from: senderLine,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        id = data.memo.id as string;
      } else if (!submit || mode === 'edit' || draftMemoId) {
        const res = await apiFetch(`/api/memos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            memo_from: senderLine,
            change_reason: submit ? 'Updated before submit' : 'Draft saved',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      if (!id) throw new Error('Memo id missing');

      if (submit) {
        const submitRes = await apiFetch(`/api/memos/${id}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            memo_from: senderLine,
            change_reason: mode === 'edit' ? 'Updated before submit' : undefined,
          }),
        });
        if (!submitRes.ok) {
          const err = await submitRes.json();
          throw new Error(err.error);
        }
        router.push(`/memos/${id}`);
      } else if (mode === 'create') {
        router.push(`/memos/${id}/edit`);
      } else {
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save memo';
      alert(submit ? `Could not submit: ${message}` : message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteDraft() {
    if (!memoId) return;
    if (!confirm('Delete this draft permanently? This cannot be undone.')) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/memos/${memoId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push('/memos?status=draft');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  }

  const pendingFirstStep =
    Boolean(statusSlug) &&
    memoAwaitingFirstApprover({
      status: {
        id: '',
        name: '',
        slug: statusSlug as MemoStatusSlug,
        sort_order: 0,
      },
      approvals,
    });
  const isEditableStatus =
    !statusSlug ||
    ['draft', 'returned', 'rejected'].includes(statusSlug) ||
    pendingFirstStep;
  const canSubmit =
    mode === 'create' ||
    !statusSlug ||
    ['draft', 'returned', 'rejected'].includes(statusSlug);
  const title =
    mode === 'create'
      ? 'Create New Memo'
      : `Edit ${statusSlug === 'draft' ? 'Draft' : 'Memo'}`;
  const subtitle =
    mode === 'create'
      ? 'Add attachments, save as draft to finish later, or submit to start approval.'
      : pendingFirstStep
        ? `${referenceNumber} — update while waiting on the first approver, then save.`
        : referenceNumber
          ? `${referenceNumber} — update fields and attachments, then save or submit.`
          : 'Update your memo and save changes.';

  if (lookupLoading) {
    return (
      <div className="max-w-4xl">
        <h1 className="page-title">{title}</h1>
        <p className="text-center py-12 text-slate-500">Loading memo form…</p>
      </div>
    );
  }

  if (lookupError) {
    return (
      <div className="max-w-4xl">
        <h1 className="page-title">{title}</h1>
        <div className="card p-6 border-amber-200 bg-amber-50">
          <p className="font-medium text-amber-900">Could not open the memo form</p>
          <p className="text-sm text-amber-800 mt-2">{lookupError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary mt-4 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle mb-6">{subtitle}</p>

      <div className="card p-6 mb-4 bg-brand-50/50 border-brand-100">
        <div className="flex gap-3">
          <Info className="text-brand-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              <strong className="text-slate-800">Drafts</strong> stay private until you submit.
              Attach supporting files below before sending for approval.
            </p>
            {pendingFirstStep && (
              <p className="text-brand-700 font-medium">
                Still with the first approver — save changes here until someone approves.
              </p>
            )}
            {statusSlug === 'returned' && (
              <p className="text-amber-700 font-medium">
                This memo was returned for correction — update and submit again.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-5">
        {mode === 'create' && (
          <div className="rounded-lg border-2 border-brand-200 bg-brand-50/80 p-4">
            <Label htmlFor="target_department_id" required>
              Department this memo is for
            </Label>
            <select
              id="target_department_id"
              value={targetDepartmentId}
              onChange={(e) => setTargetDepartmentId(e.target.value)}
              className="input-field mt-2 font-medium border-brand-300 focus:border-brand-500"
              required
            >
              <option value="">Choose department…</option>
              {lookup?.departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
            <FieldHint text="Routing uses this department (e.g. IT memos go to Emmanuel & Jim when IT is selected)." />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="memo_type_id" required>
              Memo type
            </Label>
            <select
              id="memo_type_id"
              value={form.memo_type_id}
              onChange={(e) => setForm({ ...form, memo_type_id: e.target.value })}
              className="input-field"
              required
              disabled={mode === 'edit'}
            >
              <option value="">Choose a memo type...</option>
              {(lookup?.memo_types ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {workflowHint ? (
              <p className="text-xs font-medium text-brand-700 mt-2 px-2 py-1.5 rounded-md bg-brand-50 border border-brand-100">
                {workflowHint}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="memo_date">Date</Label>
            <input
              id="memo_date"
              type="date"
              value={form.memo_date}
              onChange={(e) => setForm({ ...form, memo_date: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="memo_from">{FIELDS.memo_from.label}</Label>
          <div
            id="memo_from"
            className="input-field bg-slate-50 text-slate-800 cursor-default"
            aria-readonly="true"
          >
            {senderLine}
          </div>
          <p className="text-xs text-slate-500 mt-1">{user.email}</p>
          <FieldHint text={FIELDS.memo_from.hint} />
        </div>
        <PersonSelectField
          id="memo_thru"
          label={FIELDS.memo_thru.label}
          hint={FIELDS.memo_thru.hint}
          value={form.memo_thru}
          onChange={(memo_thru) => setForm({ ...form, memo_thru })}
          people={peopleRouting}
          lineStyle="routing"
          optional
          placeholder={FIELDS.memo_thru.placeholder}
        />
        <PersonSelectField
          id="memo_to"
          label={FIELDS.memo_to.label}
          hint={FIELDS.memo_to.hint}
          value={form.memo_to}
          onChange={(memo_to) => setForm({ ...form, memo_to })}
          people={peopleRouting}
          lineStyle="routing"
          placeholder={FIELDS.memo_to.placeholder}
        />

        <div>
          <Label htmlFor="subject" required>
            Subject
          </Label>
          <input
            id="subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="input-field"
            placeholder={FIELDS.subject.placeholder}
            required
          />
        </div>

        {(['background', 'financial_implication', 'justification', 'recommendation'] as const).map(
          (key) => {
            const cfg = FIELDS[key];
            return (
              <div key={key}>
                <Label htmlFor={key}>{cfg.label}</Label>
                <textarea
                  id={key}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="input-field min-h-[100px]"
                  rows={4}
                  placeholder={cfg.placeholder}
                />
                <FieldHint text={cfg.hint} />
              </div>
            );
          }
        )}

        {showFinance && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Approval route</span>
            <span className="block text-xs text-slate-500 mt-0.5">
              IT requests always go to Emmanuel, then Jim, then Christine (Finance), then CEO.
            </span>
          </div>
        )}

        {typeSlug === 'general_internal' && (
          <div>
            <Label htmlFor="importance_level">Importance level</Label>
            <select
              id="importance_level"
              value={form.importance_level}
              onChange={(e) => setForm({ ...form, importance_level: e.target.value })}
              className="input-field"
            >
              <option value="normal">Normal — CEO approval</option>
              <option value="high">High — CEO approval</option>
              <option value="exco">EXCO — parallel executive approval</option>
            </select>
          </div>
        )}

        {(mode === 'create' || (memoId && isEditableStatus)) && (
          <DraftAttachments
            memoId={effectiveMemoId}
            onEnsureMemoId={mode === 'create' ? ensureDraftMemo : undefined}
          />
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => persist(false)}
            disabled={loading}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {mode === 'create' ? 'Save draft' : 'Save changes'}
          </button>
          {canSubmit ? (
            <button
              type="button"
              onClick={() => persist(true)}
              disabled={loading || !form.memo_type_id || !form.subject.trim()}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Send size={16} />
              Submit for approval
            </button>
          ) : null}
          {mode === 'edit' && statusSlug === 'draft' && (
            <button
              type="button"
              onClick={deleteDraft}
              disabled={loading}
              className="btn-danger flex items-center justify-center gap-2 sm:ml-auto"
            >
              <Trash2 size={16} />
              Delete draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
