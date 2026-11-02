'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ZodType } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/farm/ConfirmDialog';
import { EmptyRow, EmptyState, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { FormSheet } from '@/components/farm/FormSheet';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { StatusChip } from '@/components/farm/StatusChip';
import { NumberField, SelectField, SwitchField, TextareaField, TextField, type SelectOption } from '@/components/farm/fields';
import { farmKeys, useMasterList } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation, useFormMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { fmtNumber } from '@/lib/farm/format';
import { MASTER_DATA, type MasterDataType } from '@/lib/farm/masterData';
import {
  ACTIVITY_CATEGORIES,
  CAPACITY_UNITS,
  DOCUMENT_CATEGORIES,
  GRADE_PURPOSES,
  LOCATION_TYPES,
  optionLabel,
} from '@/lib/farm/schemas';

type Item = Record<string, unknown> & { id: string; code: string; name: string; status: string };
type Values = Record<string, unknown>;

type FieldDef =
  | { kind: 'text'; name: string; label: string; required?: boolean; uppercase?: boolean; wide?: boolean }
  | { kind: 'number'; name: string; label: string; required?: boolean; step?: string; suffix?: string; description?: string }
  | { kind: 'select'; name: string; label: string; options: SelectOption[] }
  | { kind: 'switch'; name: string; label: string; description?: string }
  | { kind: 'textarea'; name: string; label: string };

type Column = { label: string; align?: 'right'; render: (item: Item) => React.ReactNode };

type PageConfig = {
  title: string;
  singular: string;
  subtitle: string;
  defaults: Values;
  fields: FieldDef[];
  columns: Column[];
  inUseHint: string;
};

const toOptions = (values: readonly string[]): SelectOption[] => values.map((v) => ({ value: v, label: optionLabel(v) }));
const STATUS_FIELD: FieldDef = { kind: 'select', name: 'status', label: 'Status', options: toOptions(['active', 'inactive']) };
const yesNo = (v: unknown) => (v ? 'Yes' : 'No');

const PAGES: Record<MasterDataType, PageConfig> = {
  grades: {
    title: 'Grades',
    singular: 'grade',
    subtitle: 'Quality grades used when grading harvested produce. Enable them per crop on the crop page.',
    defaults: { code: '', name: '', purpose: 'export', is_reject: false, sort_order: 0, description: '', status: 'active' },
    fields: [
      { kind: 'text', name: 'code', label: 'Code', required: true, uppercase: true },
      { kind: 'text', name: 'name', label: 'Name', required: true, wide: true },
      { kind: 'select', name: 'purpose', label: 'Purpose', options: toOptions(GRADE_PURPOSES) },
      { kind: 'number', name: 'sort_order', label: 'Display order', required: true, step: '1' },
      STATUS_FIELD,
      { kind: 'switch', name: 'is_reject', label: 'Reject grade', description: 'Produce in this grade is excluded from export stock.' },
      { kind: 'textarea', name: 'description', label: 'Description' },
    ],
    columns: [
      { label: 'Purpose', render: (i) => <StatusChip status={String(i.purpose)} /> },
      { label: 'Reject', render: (i) => yesNo(i.is_reject) },
      { label: 'Order', align: 'right', render: (i) => String(i.sort_order) },
    ],
    inUseHint: 'Grades enabled on a crop cannot be deleted — mark them inactive instead.',
  },
  'packaging-types': {
    title: 'Packaging types',
    singular: 'packaging type',
    subtitle: 'Cartons, crates and other packaging used when packing produce for export.',
    defaults: {
      code: '',
      name: '',
      standard_capacity: null,
      capacity_unit: 'kg',
      tare_weight_kg: null,
      description: '',
      status: 'active',
    },
    fields: [
      { kind: 'text', name: 'code', label: 'Code', required: true, uppercase: true },
      { kind: 'text', name: 'name', label: 'Name', required: true, wide: true },
      { kind: 'number', name: 'standard_capacity', label: 'Standard capacity', required: true },
      { kind: 'select', name: 'capacity_unit', label: 'Capacity unit', options: toOptions(CAPACITY_UNITS) },
      { kind: 'number', name: 'tare_weight_kg', label: 'Empty weight', suffix: 'kg', description: 'Used to work out gross weight' },
      STATUS_FIELD,
      { kind: 'textarea', name: 'description', label: 'Description' },
    ],
    columns: [
      { label: 'Capacity', align: 'right', render: (i) => `${fmtNumber(i.standard_capacity as number)} ${i.capacity_unit}` },
      { label: 'Empty weight', align: 'right', render: (i) => (i.tare_weight_kg == null ? '—' : `${fmtNumber(i.tare_weight_kg as number)} kg`) },
    ],
    inUseHint: 'Packaging types already used cannot be deleted — mark them inactive instead.',
  },
  'document-types': {
    title: 'Document types',
    singular: 'document type',
    subtitle: 'Documents tracked for exports, suppliers, buyers and quality — and which are required before shipping.',
    defaults: {
      code: '',
      name: '',
      category: 'export',
      is_mandatory_for_export: false,
      has_expiry: false,
      requires_approval: false,
      sort_order: 0,
      description: '',
      status: 'active',
    },
    fields: [
      { kind: 'text', name: 'code', label: 'Code', required: true, uppercase: true },
      { kind: 'text', name: 'name', label: 'Name', required: true, wide: true },
      { kind: 'select', name: 'category', label: 'Category', options: toOptions(DOCUMENT_CATEGORIES) },
      { kind: 'number', name: 'sort_order', label: 'Display order', required: true, step: '1' },
      STATUS_FIELD,
      {
        kind: 'switch',
        name: 'is_mandatory_for_export',
        label: 'Required for export',
        description: 'A shipment cannot be dispatched until this document is uploaded.',
      },
      { kind: 'switch', name: 'has_expiry', label: 'Has an expiry date', description: 'Prompt for an expiry date on upload and alert before it lapses.' },
      { kind: 'switch', name: 'requires_approval', label: 'Requires approval', description: 'Uploaded documents must be approved before they count.' },
      { kind: 'textarea', name: 'description', label: 'Description' },
    ],
    columns: [
      { label: 'Category', render: (i) => optionLabel(String(i.category)) },
      { label: 'Required for export', render: (i) => yesNo(i.is_mandatory_for_export) },
      { label: 'Expires', render: (i) => yesNo(i.has_expiry) },
      { label: 'Approval', render: (i) => yesNo(i.requires_approval) },
    ],
    inUseHint: 'Document types with uploaded documents cannot be deleted — mark them inactive instead.',
  },
  'activity-types': {
    title: 'Activity types',
    singular: 'activity type',
    subtitle: 'Kinds of field work recorded against blocks and assigned as worker tasks.',
    defaults: { code: '', name: '', category: 'other', uses_inputs: false, sort_order: 0, description: '', status: 'active' },
    fields: [
      { kind: 'text', name: 'code', label: 'Code', required: true, uppercase: true },
      { kind: 'text', name: 'name', label: 'Name', required: true, wide: true },
      { kind: 'select', name: 'category', label: 'Category', options: toOptions(ACTIVITY_CATEGORIES) },
      { kind: 'number', name: 'sort_order', label: 'Display order', required: true, step: '1' },
      STATUS_FIELD,
      {
        kind: 'switch',
        name: 'uses_inputs',
        label: 'Uses inputs',
        description: 'Show the inputs and materials section (fertilizer, chemicals, seed) when recording this activity.',
      },
      { kind: 'textarea', name: 'description', label: 'Description' },
    ],
    columns: [
      { label: 'Category', render: (i) => optionLabel(String(i.category)) },
      { label: 'Uses inputs', render: (i) => yesNo(i.uses_inputs) },
      { label: 'Order', align: 'right', render: (i) => String(i.sort_order) },
    ],
    inUseHint: 'Activity types already recorded cannot be deleted — mark them inactive instead.',
  },
  'rejection-reasons': {
    title: 'Rejection reasons',
    singular: 'rejection reason',
    subtitle: 'Reasons graders can give when produce is rejected.',
    defaults: { code: '', name: '', sort_order: 0, description: '', status: 'active' },
    fields: [
      { kind: 'text', name: 'code', label: 'Code', required: true, uppercase: true },
      { kind: 'text', name: 'name', label: 'Name', required: true, wide: true },
      { kind: 'number', name: 'sort_order', label: 'Display order', required: true, step: '1' },
      STATUS_FIELD,
      { kind: 'textarea', name: 'description', label: 'Description' },
    ],
    columns: [{ label: 'Order', align: 'right', render: (i) => String(i.sort_order) }],
    inUseHint: 'Reasons already used in grading cannot be deleted — mark them inactive instead.',
  },
  'warehouse-locations': {
    title: 'Warehouse locations',
    singular: 'warehouse location',
    subtitle: 'Cold rooms, stores and bays where packed batches are received and kept until dispatch.',
    defaults: { code: '', name: '', location_type: 'cold_room', sort_order: 0, description: '', status: 'active' },
    fields: [
      { kind: 'text', name: 'code', label: 'Code', required: true, uppercase: true },
      { kind: 'text', name: 'name', label: 'Name', required: true, wide: true },
      { kind: 'select', name: 'location_type', label: 'Type', options: toOptions(LOCATION_TYPES) },
      { kind: 'number', name: 'sort_order', label: 'Display order', required: true, step: '1' },
      STATUS_FIELD,
      { kind: 'textarea', name: 'description', label: 'Description' },
    ],
    columns: [
      { label: 'Type', render: (i) => optionLabel(String(i.location_type)) },
      { label: 'Order', align: 'right', render: (i) => String(i.sort_order) },
    ],
    inUseHint: 'Locations holding or that have held stock cannot be deleted — mark them inactive instead.',
  },
};

function toValues(config: PageConfig, item: Item | null): Values {
  if (!item) return { ...config.defaults };
  return Object.fromEntries(Object.keys(config.defaults).map((k) => [k, item[k] ?? config.defaults[k]]));
}

function renderField(f: FieldDef) {
  switch (f.kind) {
    case 'text':
      return (
        <TextField<Values>
          key={f.name}
          name={f.name}
          label={f.label}
          required={f.required}
          uppercase={f.uppercase}
          className={f.wide ? 'sm:col-span-2' : undefined}
        />
      );
    case 'number':
      return (
        <NumberField<Values>
          key={f.name}
          name={f.name}
          label={f.label}
          required={f.required}
          step={f.step}
          suffix={f.suffix}
          description={f.description}
        />
      );
    case 'select':
      return <SelectField<Values> key={f.name} name={f.name} label={f.label} required options={f.options} />;
    case 'switch':
      return <SwitchField<Values> key={f.name} name={f.name} label={f.label} description={f.description} className="sm:col-span-2" />;
    case 'textarea':
      return <TextareaField<Values> key={f.name} name={f.name} label={f.label} className="sm:col-span-2" />;
  }
}

function MasterItemSheet({
  type,
  config,
  open,
  onOpenChange,
  item,
}: {
  type: MasterDataType;
  config: PageConfig;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: Item | null;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(MASTER_DATA[type].schema as ZodType<Values, Values>),
    defaultValues: toValues(config, item),
  });

  useEffect(() => {
    if (open) form.reset(toValues(config, item));
  }, [open, item, config, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch(item ? `/api/farm/master/${type}/${item.id}` : `/api/farm/master/${type}`, {
        method: item ? 'PATCH' : 'POST',
        body: values,
      }),
    {
      success: item ? `${optionLabel(config.singular)} updated` : `${optionLabel(config.singular)} added`,
      invalidate: [farmKeys.master(type)],
      onDone: () => onOpenChange(false),
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? `Edit ${item.name}` : `New ${config.singular}`}
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={item ? 'Save changes' : `Add ${config.singular}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {config.fields.filter((f) => f.kind !== 'switch' && f.kind !== 'textarea').map(renderField)}
      </div>
      <div className="grid gap-3">{config.fields.filter((f) => f.kind === 'switch' || f.kind === 'textarea').map(renderField)}</div>
    </FormSheet>
  );
}

function MasterDataPage({ type }: { type: MasterDataType }) {
  const config = PAGES[type];
  const { can } = useFarmAccess();
  const canManage = can('admin.settings');
  const list = useMasterList<Item>(type);
  const [sheet, setSheet] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });
  const [deleting, setDeleting] = useState<Item | null>(null);

  const remove = useActionMutation((id: string) => farmFetch(`/api/farm/master/${type}/${id}`, { method: 'DELETE' }), {
    success: `${optionLabel(config.singular)} deleted`,
    invalidate: [farmKeys.master(type)],
    onDone: () => setDeleting(null),
  });

  const columnCount = 3 + config.columns.length + (canManage ? 1 : 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          canManage ? (
            <Button onClick={() => setSheet({ open: true, item: null })}>
              <Plus className="size-4" /> New {config.singular}
            </Button>
          ) : null
        }
      />

      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <div className="data-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                {config.columns.map((c) => (
                  <TableHead key={c.label} className={c.align === 'right' ? 'text-right' : undefined}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead>Status</TableHead>
                {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <LoadingRows columns={columnCount} />
              ) : !list.data?.length ? (
                <EmptyRow columns={columnCount} title={`No ${config.title.toLowerCase()} yet`} />
              ) : (
                list.data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell>
                      <span className="font-medium">{item.name}</span>
                      {item.description ? (
                        <p className="max-w-72 truncate text-xs text-muted-foreground">{String(item.description)}</p>
                      ) : null}
                    </TableCell>
                    {config.columns.map((c) => (
                      <TableCell key={c.label} className={c.align === 'right' ? 'text-right whitespace-nowrap' : undefined}>
                        {c.render(item)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <StatusChip status={item.status} />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" aria-label="Edit" onClick={() => setSheet({ open: true, item })}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => setDeleting(item)}>
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
      )}

      <MasterItemSheet
        type={type}
        config={config}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        item={sheet.item}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description={config.inUseHint}
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

export default function Page() {
  const { type } = useParams<{ type: string }>();
  return (
    <RequirePermission permission="admin.settings">
      {type in PAGES ? (
        <MasterDataPage key={type} type={type as MasterDataType} />
      ) : (
        <EmptyState title="List not found" description="This master data list does not exist." />
      )}
    </RequirePermission>
  );
}
