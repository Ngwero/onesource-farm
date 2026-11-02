import { formatISO } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { HttpError } from './http';
import type { PlantingCycleInput } from './schemas';

/** Checks that need other rows: active crop, variety of that crop, block on this farm. */
export async function validatePlantingCycle(
  input: PlantingCycleInput,
  farmId: string,
  existingCropId?: string
): Promise<PlantingCycleInput> {
  const supabase = createServiceClient();

  const [blockRes, cropRes] = await Promise.all([
    supabase.from('blocks').select('id, status').eq('id', input.block_id).eq('farm_id', farmId).maybeSingle(),
    supabase.from('crops').select('id, status').eq('id', input.crop_id).maybeSingle(),
  ]);
  if (blockRes.error) throw blockRes.error;
  if (cropRes.error) throw cropRes.error;
  if (!blockRes.data) throw new HttpError('Block not found on this farm', 400, { block_id: 'Block not found' });
  if (!cropRes.data) throw new HttpError('Crop not found', 400, { crop_id: 'Crop not found' });
  if (cropRes.data.status !== 'active' && cropRes.data.id !== existingCropId) {
    throw new HttpError('This crop is inactive', 400, { crop_id: 'Crop is inactive' });
  }
  if (blockRes.data.status === 'inactive' && ['active', 'harvesting'].includes(input.status)) {
    throw new HttpError('Reactivate the block before planting in it', 400, { status: 'Block is inactive' });
  }

  const closing = ['completed', 'abandoned'].includes(input.status);
  return {
    ...input,
    closed_at: closing ? input.closed_at ?? formatISO(new Date(), { representation: 'date' }) : null,
  };
}

/** The partial unique index allows only one active/harvesting cycle per block. */
export function openCycleConflictMessage(err: unknown): HttpError | null {
  const e = err as { code?: string; message?: string };
  if (e?.code === '23505' && e.message?.includes('uq_planting_cycles_open_per_block')) {
    return new HttpError(
      'This block already has an active planting. Complete or abandon it first.',
      409,
      { status: 'Block already has an active planting' }
    );
  }
  return null;
}
