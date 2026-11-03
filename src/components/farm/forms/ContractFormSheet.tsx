'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSheet } from '@/components/farm/FormSheet';
import { DateField, NumberField, SelectField, TextareaField, TextField } from '@/components/farm/fields';
import { farmKeys, useCrops, useMasterList } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { todayIso } from '@/lib/farm/format';
import {
  CONTRACT_STATUSES,
  contractSchema,
  optionLabel,
  type ContractInput,
} from '@/lib/farm/schemas';
import type { BuyerRow, ContractRow, GradeRow } from '@/lib/farm/types';

function toValues(contract?: ContractRow | null, defaults?: Partial<ContractInput>): ContractInput {
  if (!contract) {
    return {
      buyer_id: '',
      contract_no: '',
      crop_id: null,
      grade_id: null,
      title: '',
      start_date: todayIso(),
      end_date: null,
      agreed_quantity: null as unknown as number,
      quantity_unit: 'kg',
      unit_price: null as unknown as number,
      currency: 'USD',
      specifications: '',
      status: 'draft',
      notes: '',
      ...defaults,
    };
  }
  return {
    buyer_id: contract.buyer_id,
    contract_no: contract.contract_no,
    crop_id: contract.crop_id,
    grade_id: contract.grade_id,
    title: contract.title,
    start_date: contract.start_date,
    end_date: contract.end_date,
    agreed_quantity: Number(contract.agreed_quantity),
    quantity_unit: contract.quantity_unit,
    unit_price: Number(contract.unit_price),
    currency: contract.currency,
    specifications: contract.specifications ?? '',
    status: contract.status,
    notes: contract.notes ?? '',
  };
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract?: ContractRow | null;
  buyers: BuyerRow[];
  defaults?: Partial<ContractInput>;
  onSaved?: (contract: ContractRow) => void;
};

export function ContractFormSheet({ open, onOpenChange, contract, buyers, defaults, onSaved }: Props) {
  const crops = useCrops();
  const grades = useMasterList<GradeRow>('grades');
  const form = useForm<ContractInput>({
    resolver: zodResolver(contractSchema),
    defaultValues: toValues(contract, defaults),
  });

  useEffect(() => {
    if (open) form.reset(toValues(contract, defaults));
  }, [open, contract, defaults, form]);

  const save = useFormMutation(
    form,
    (values) =>
      farmFetch<{ contract: ContractRow }>(
        contract ? `/api/farm/contracts/${contract.id}` : '/api/farm/contracts',
        { method: contract ? 'PATCH' : 'POST', body: values }
      ),
    {
      success: contract ? 'Contract updated' : 'Contract created',
      invalidate: [farmKeys.contracts, ...(contract ? [farmKeys.contract(contract.id)] : [])],
      onDone: (r) => {
        onOpenChange(false);
        onSaved?.(r.contract);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={contract ? `Edit ${contract.contract_no}` : 'New contract'}
      description="Supply agreements with agreed quantity, price and crop specification."
      form={form}
      onSubmit={(v) => save.mutate(v)}
      pending={save.isPending}
      submitLabel={contract ? 'Save changes' : 'Create contract'}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField<ContractInput>
          name="buyer_id"
          label="Buyer"
          required
          options={buyers.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
        />
        <TextField<ContractInput> name="contract_no" label="Contract number" required placeholder="CTR-2026-01" />
        <TextField<ContractInput> name="title" label="Title" required className="sm:col-span-2" placeholder="Chilli export — Q1" />
        <SelectField<ContractInput>
          name="crop_id"
          label="Crop"
          emptyLabel="Any crop"
          options={(crops.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField<ContractInput>
          name="grade_id"
          label="Grade"
          emptyLabel="Any grade"
          options={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
        />
        <DateField<ContractInput> name="start_date" label="Start date" required />
        <DateField<ContractInput> name="end_date" label="End date" />
        <NumberField<ContractInput> name="agreed_quantity" label="Agreed quantity" required />
        <TextField<ContractInput> name="quantity_unit" label="Unit" required placeholder="kg" />
        <NumberField<ContractInput> name="unit_price" label="Unit price" required />
        <TextField<ContractInput> name="currency" label="Currency" required uppercase placeholder="USD" />
        <SelectField<ContractInput>
          name="status"
          label="Status"
          required
          options={CONTRACT_STATUSES.map((s) => ({ value: s, label: optionLabel(s) }))}
        />
      </div>
      <TextareaField<ContractInput> name="specifications" label="Specifications" />
      <TextareaField<ContractInput> name="notes" label="Notes" />
    </FormSheet>
  );
}
