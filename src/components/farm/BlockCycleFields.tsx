'use client';

import { useFormContext, useWatch, type FieldValues, type Path, type PathValue } from 'react-hook-form';
import { SelectField } from '@/components/farm/fields';
import { useBlocks, useOpenCycles } from '@/hooks/farm';
import { fmtDate } from '@/lib/farm/format';

type Props = {
  blockRequired?: boolean;
  /** Keep the saved planting selectable even if it is no longer open (editing old records). */
  currentCycle?: { id: string; blockId: string; label: string } | null;
};

/**
 * Block → planting pickers bound to `block_id` and `planting_cycle_id`.
 * Choosing a block selects its open planting; the crop is derived from the planting on the server.
 */
export function BlockCycleFields<T extends FieldValues>({ blockRequired = true, currentCycle }: Props) {
  const { control, setValue } = useFormContext<T>();
  const blocks = useBlocks();
  const cycles = useOpenCycles();
  const blockId = useWatch({ control, name: 'block_id' as Path<T> }) as string | null | undefined;

  const options = (cycles.data ?? [])
    .filter((c) => c.block_id === blockId)
    .map((c) => ({
      value: c.id,
      label: `${c.crop?.name ?? 'Crop'}${c.variety ? ` · ${c.variety.name}` : ''}, planted ${fmtDate(c.planting_date)}${c.season_label ? ` (${c.season_label})` : ''}`,
    }));
  if (currentCycle && currentCycle.blockId === blockId && !options.some((o) => o.value === currentCycle.id)) {
    options.unshift({ value: currentCycle.id, label: currentCycle.label });
  }

  function onBlockChange(next: string | null) {
    const open = (cycles.data ?? []).filter((c) => c.block_id === next);
    setValue('planting_cycle_id' as Path<T>, (open.length === 1 ? open[0].id : null) as PathValue<T, Path<T>>);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField<T>
        name={'block_id' as Path<T>}
        label="Block"
        required={blockRequired}
        emptyLabel={blockRequired ? undefined : 'No specific block'}
        onValueChange={onBlockChange}
        options={(blocks.data ?? [])
          .filter((b) => b.status !== 'inactive' || b.id === blockId)
          .map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }))}
      />
      <SelectField<T>
        name={'planting_cycle_id' as Path<T>}
        label="Planting"
        emptyLabel={blockId ? 'Not linked to a planting' : 'Choose a block first'}
        disabled={!blockId}
        options={options}
        description={blockId && !options.length ? 'This block has no active planting.' : undefined}
      />
    </div>
  );
}
