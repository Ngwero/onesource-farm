'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { CriterionSheet } from '@/components/farm/forms/CriterionSheet';
import { CropFormSheet } from '@/components/farm/forms/CropFormSheet';
import { VarietySheet } from '@/components/farm/forms/VarietySheet';
import { farmKeys, useMasterList } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtNumber } from '@/lib/farm/format';
import { optionLabel } from '@/lib/farm/schemas';
import type { CropDetail, GradeRow, QualityCriterionRow, VarietyRow } from '@/lib/farm/types';

type SheetState<T> = { open: boolean; item: T | null };
const closed = { open: false, item: null };

function VarietiesPanel({ crop, canManage }: { crop: CropDetail; canManage: boolean }) {
  const [sheet, setSheet] = useState<SheetState<VarietyRow>>(closed);
  const [deleting, setDeleting] = useState<VarietyRow | null>(null);
  const remove = useActionMutation((id: string) => farmFetch(`/api/farm/varieties/${id}`, { method: 'DELETE' }), {
    success: 'Variety deleted',
    invalidate: [farmKeys.crop(crop.id), farmKeys.crops],
    onDone: () => setDeleting(null),
  });

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setSheet({ open: true, item: null })}>
            <Plus className="size-4" /> New variety
          </Button>
        </div>
      ) : null}
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Variety</TableHead>
              <TableHead className="text-right">Days to maturity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {crop.varieties.length === 0 ? (
              <EmptyRow columns={canManage ? 6 : 5} title="No varieties yet" />
            ) : (
              crop.varieties.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.code}</TableCell>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-right">{v.maturity_days ?? crop.maturity_days ?? '—'}</TableCell>
                  <TableCell className="max-w-72 truncate text-muted-foreground">{v.description || '—'}</TableCell>
                  <TableCell>
                    <StatusChip status={v.status} />
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" aria-label="Edit variety" onClick={() => setSheet({ open: true, item: v })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="Delete variety" onClick={() => setDeleting(v)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <VarietySheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        cropId={crop.id}
        variety={sheet.item}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete variety ${deleting?.name ?? ''}?`}
        description="Varieties used in plantings cannot be deleted — mark them inactive instead."
        confirmLabel="Delete variety"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function GradingPanel({ crop, canManage }: { crop: CropDetail; canManage: boolean }) {
  const grades = useMasterList<GradeRow>('grades');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(crop.grade_ids));
  const dirty =
    selected.size !== crop.grade_ids.length || crop.grade_ids.some((id) => !selected.has(id));

  const save = useActionMutation(
    () => farmFetch(`/api/farm/crops/${crop.id}/grades`, { method: 'PUT', body: { grade_ids: [...selected] } }),
    { success: 'Grading updated', invalidate: [farmKeys.crop(crop.id), farmKeys.crops] }
  );

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const visible = (grades.data ?? []).filter((g) => g.status === 'active' || selected.has(g.id));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Grades graders can assign to {crop.name} after harvest. Manage the grade list under Administration → Grades.
      </p>
      {grades.error ? (
        <ErrorState message={errorMessage(grades.error)} onRetry={() => grades.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Use</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Reject grade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.isLoading ? (
                <LoadingRows columns={5} rows={4} />
              ) : visible.length === 0 ? (
                <EmptyRow columns={5} title="No grades configured" />
              ) : (
                visible.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(g.id)}
                        disabled={!canManage || save.isPending}
                        onCheckedChange={(v) => toggle(g.id, v === true)}
                        aria-label={`Use grade ${g.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{g.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{g.code}</span>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={g.purpose} />
                    </TableCell>
                    <TableCell>{g.is_reject ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <StatusChip status={g.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {canManage ? (
        <div className="flex items-center justify-end gap-2">
          {dirty ? (
            <Button variant="outline" onClick={() => setSelected(new Set(crop.grade_ids))} disabled={save.isPending}>
              Reset
            </Button>
          ) : null}
          <Button onClick={() => save.mutate(undefined)} disabled={!dirty || selected.size === 0 || save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save grading
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function criterionRange(c: QualityCriterionRow): string {
  if (c.criterion_type !== 'numeric' && c.criterion_type !== 'scale') return '—';
  const unit = c.unit ? ` ${c.unit}` : '';
  if (c.min_value != null && c.max_value != null) return `${fmtNumber(c.min_value)}–${fmtNumber(c.max_value)}${unit}`;
  if (c.min_value != null) return `≥ ${fmtNumber(c.min_value)}${unit}`;
  if (c.max_value != null) return `≤ ${fmtNumber(c.max_value)}${unit}`;
  return '—';
}

function CriteriaPanel({ crop, canManage }: { crop: CropDetail; canManage: boolean }) {
  const [sheet, setSheet] = useState<SheetState<QualityCriterionRow>>(closed);
  const [deleting, setDeleting] = useState<QualityCriterionRow | null>(null);
  const remove = useActionMutation((id: string) => farmFetch(`/api/farm/criteria/${id}`, { method: 'DELETE' }), {
    success: 'Quality check deleted',
    invalidate: [farmKeys.crop(crop.id)],
    onDone: () => setDeleting(null),
  });
  const nextOrder = crop.criteria.reduce((max, c) => Math.max(max, c.sort_order), 0) + 10;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Checks QC inspectors complete for each {crop.name} lot.</p>
        {canManage ? (
          <Button size="sm" onClick={() => setSheet({ open: true, item: null })}>
            <Plus className="size-4" /> New check
          </Button>
        ) : null}
      </div>
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Check</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Acceptable range</TableHead>
              <TableHead>Mandatory</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {crop.criteria.length === 0 ? (
              <EmptyRow columns={canManage ? 7 : 6} title="No quality checks yet" />
            ) : (
              crop.criteria.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <span className="font-medium">{c.name}</span>
                    {c.guidance ? <p className="max-w-80 truncate text-xs text-muted-foreground">{c.guidance}</p> : null}
                  </TableCell>
                  <TableCell>{optionLabel(c.criterion_type)}</TableCell>
                  <TableCell className="whitespace-nowrap">{criterionRange(c)}</TableCell>
                  <TableCell>{c.is_mandatory ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <StatusChip status={c.status} />
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" aria-label="Edit check" onClick={() => setSheet({ open: true, item: c })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="Delete check" onClick={() => setDeleting(c)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <CriterionSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        cropId={crop.id}
        criterion={sheet.item}
        nextOrder={nextOrder}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete check "${deleting?.name ?? ''}"?`}
        description="To stop using a check but keep it on record, mark it inactive instead."
        confirmLabel="Delete check"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function CropDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useFarmAccess();
  const canManage = can('crops.manage');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const crop = useQuery({
    queryKey: farmKeys.crop(id),
    queryFn: () => farmFetch<{ crop: CropDetail }>(`/api/farm/crops/${id}`).then((r) => r.crop),
  });

  const remove = useActionMutation(() => farmFetch(`/api/farm/crops/${id}`, { method: 'DELETE' }), {
    success: 'Crop deleted',
    invalidate: [farmKeys.crops],
    onDone: () => router.push('/farm/crops'),
  });

  if (crop.error) return <ErrorState message={errorMessage(crop.error)} onRetry={() => crop.refetch()} />;
  const c = crop.data;
  if (!c) return <div className="dashboard-loading">Loading crop…</div>;

  return (
    <div className="space-y-6">
      <Link href="/farm/crops" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Crops
      </Link>

      <PageHeader
        title={c.name}
        meta={<StatusChip status={c.status} />}
        subtitle={[
          c.code,
          c.scientific_name,
          optionLabel(c.production_cycle),
          c.maturity_days ? `${c.maturity_days} days to maturity` : null,
          `measured in ${c.default_unit}`,
          `${c.open_cycles} active planting${c.open_cycles === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </>
          ) : null
        }
      />

      {c.description ? <p className="max-w-3xl text-sm text-muted-foreground">{c.description}</p> : null}

      <Tabs defaultValue="varieties">
        <TabsList>
          <TabsTrigger value="varieties">Varieties ({c.varieties.length})</TabsTrigger>
          <TabsTrigger value="grading">Grading ({c.grade_ids.length})</TabsTrigger>
          <TabsTrigger value="quality">Quality checks ({c.criteria.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="varieties" className="mt-4">
          <VarietiesPanel crop={c} canManage={canManage} />
        </TabsContent>
        <TabsContent value="grading" className="mt-4">
          <GradingPanel key={c.grade_ids.join(',')} crop={c} canManage={canManage} />
        </TabsContent>
        <TabsContent value="quality" className="mt-4">
          <CriteriaPanel crop={c} canManage={canManage} />
        </TabsContent>
      </Tabs>

      <CropFormSheet open={editing} onOpenChange={setEditing} crop={c} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete crop ${c.name}?`}
        description="Crops used in plantings cannot be deleted — mark them inactive instead. Varieties, grading and quality checks for this crop are removed with it."
        confirmLabel="Delete crop"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="crops.view">
      <CropDetailPage />
    </RequirePermission>
  );
}
