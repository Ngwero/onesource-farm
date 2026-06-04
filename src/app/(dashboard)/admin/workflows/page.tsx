'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { Pencil, Save, X, Plus, Trash2 } from 'lucide-react';

type StepRow = {
  id?: string;
  step_order: number;
  role_slug: string;
  step_name: string;
  is_parallel: boolean;
  sla_hours: number;
};

type WorkflowRow = {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  requires_exco: boolean;
  requires_finance: boolean;
  memo_types?: { name: string; slug: string };
  approval_steps?: StepRow[];
};

const ROLE_OPTIONS = [
  { slug: 'department_head', label: 'Department Head' },
  { slug: 'business_head', label: 'Business Head (Norman)' },
  { slug: 'it_checker_first', label: 'IT Checker — 1st (Emma)' },
  { slug: 'it_checker_second', label: 'IT Checker — 2nd (Jim)' },
  { slug: 'finance_reviewer', label: 'Finance Reviewer' },
  { slug: 'hr_reviewer', label: 'HR Reviewer' },
  { slug: 'ceo', label: 'CEO' },
  { slug: 'exco_member', label: 'EXCO Member' },
];

function emptyStep(order: number): StepRow {
  return {
    step_order: order,
    role_slug: 'department_head',
    step_name: 'Approval step',
    is_parallel: false,
    sla_hours: 24,
  };
}

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WorkflowRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/api/admin/workflows')
      .then((r) => r.json())
      .then((d) => setWorkflows(d.workflows || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(w: WorkflowRow) {
    setEditingId(w.id);
    setDraft({
      ...w,
      approval_steps: (w.approval_steps || []).map((s) => ({ ...s })),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function updateStep(index: number, patch: Partial<StepRow>) {
    if (!draft) return;
    const steps = [...(draft.approval_steps || [])];
    steps[index] = { ...steps[index], ...patch };
    setDraft({ ...draft, approval_steps: steps });
  }

  function addStep() {
    if (!draft) return;
    const steps = [...(draft.approval_steps || [])];
    steps.push(emptyStep(steps.length + 1));
    setDraft({ ...draft, approval_steps: steps });
  }

  function removeStep(index: number) {
    if (!draft || (draft.approval_steps?.length || 0) <= 1) return;
    const steps = (draft.approval_steps || []).filter((_, i) => i !== index);
    setDraft({ ...draft, approval_steps: steps });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/workflows/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          is_active: draft.is_active,
          requires_exco: draft.requires_exco,
          requires_finance: draft.requires_finance,
          steps: draft.approval_steps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWorkflows((list) => list.map((w) => (w.id === draft.id ? data.workflow : w)));
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Approval Workflows</h1>
      <p className="text-slate-500 text-sm mb-6">
        Edit approval steps per memo type. Changes apply to new submissions and routing after save.
        EXCO parallel and IT budget rules still apply from memo options at submit time.
      </p>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-4">
          {workflows.map((w) => {
            const isEditing = editingId === w.id && draft;
            const view = isEditing ? draft! : w;

            return (
              <div key={w.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        className="input-field font-semibold mb-2"
                        value={view.name}
                        onChange={(e) => setDraft({ ...draft!, name: e.target.value })}
                      />
                    ) : (
                      <h2 className="font-semibold text-slate-800">{view.name}</h2>
                    )}
                    <p className="text-sm text-slate-500">
                      {view.memo_types?.name || 'Unknown type'}
                      {view.is_default ? ' · Default' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={save}
                          disabled={saving}
                          className="btn-primary text-sm flex items-center gap-1"
                        >
                          <Save size={14} />
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" onClick={cancelEdit} className="btn-secondary text-sm">
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(w)}
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={view.is_active}
                        onChange={(e) => setDraft({ ...draft!, is_active: e.target.checked })}
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={view.requires_finance}
                        onChange={(e) =>
                          setDraft({ ...draft!, requires_finance: e.target.checked })
                        }
                      />
                      Requires finance
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={view.requires_exco}
                        onChange={(e) => setDraft({ ...draft!, requires_exco: e.target.checked })}
                      />
                      Requires EXCO
                    </label>
                  </div>
                )}

                <ol className="space-y-3">
                  {(view.approval_steps || []).map((s, index) => (
                    <li
                      key={s.id || index}
                      className="flex flex-wrap items-center gap-2 text-sm border-l-2 border-brand-200 pl-3 py-1"
                    >
                      <span className="font-mono text-brand-600 w-6">{index + 1}</span>
                      {isEditing ? (
                        <>
                          <input
                            className="input-field flex-1 min-w-[140px] py-1.5 text-sm"
                            value={s.step_name}
                            onChange={(e) => updateStep(index, { step_name: e.target.value })}
                            placeholder="Step name"
                          />
                          <select
                            className="input-field py-1.5 text-sm"
                            value={s.role_slug}
                            onChange={(e) => updateStep(index, { role_slug: e.target.value })}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.slug} value={r.slug}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            className="input-field w-16 py-1.5 text-sm"
                            value={s.sla_hours}
                            onChange={(e) =>
                              updateStep(index, { sla_hours: parseInt(e.target.value, 10) || 24 })
                            }
                            title="SLA hours"
                          />
                          <span className="text-slate-400 text-xs">h</span>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={s.is_parallel}
                              onChange={(e) =>
                                updateStep(index, { is_parallel: e.target.checked })
                              }
                            />
                            Parallel
                          </label>
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="text-red-500 p-1"
                            aria-label="Remove step"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{s.step_name}</span>
                          <span className="text-slate-400">({s.role_slug.replace(/_/g, ' ')})</span>
                          <span className="text-slate-400 ml-auto">{s.sla_hours}h SLA</span>
                          {s.is_parallel && (
                            <span className="text-xs text-purple-600">parallel</span>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ol>

                {isEditing && (
                  <button
                    type="button"
                    onClick={addStep}
                    className="mt-3 text-sm text-brand-600 flex items-center gap-1 hover:underline"
                  >
                    <Plus size={14} />
                    Add step
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
