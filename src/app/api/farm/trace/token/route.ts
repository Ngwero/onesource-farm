import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { newPublicToken } from '@/lib/farm/publicTrace';

const createTokenSchema = z
  .object({
    subject_type: z.enum(['harvest_batch', 'packing_batch']),
    harvest_batch_id: z.uuid().optional(),
    packing_batch_id: z.uuid().optional(),
    label: z.string().trim().max(120).nullable().optional(),
  })
  .refine(
    (v) =>
      (v.subject_type === 'harvest_batch' && v.harvest_batch_id && !v.packing_batch_id) ||
      (v.subject_type === 'packing_batch' && v.packing_batch_id && !v.harvest_batch_id),
    { message: 'Provide exactly one harvest_batch_id or packing_batch_id matching subject_type.' }
  );

export async function POST(request: Request) {
  return withPermission('traceability.view', async ({ user }) => {
    const input = await parseBody(request, createTokenSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    if (input.subject_type === 'harvest_batch') {
      const { data, error } = await supabase
        .from('harvest_batches')
        .select('id')
        .eq('id', input.harvest_batch_id!)
        .eq('farm_id', farmId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError('Harvest batch not found.', 404);
    } else {
      const { data, error } = await supabase
        .from('packing_batches')
        .select('id')
        .eq('id', input.packing_batch_id!)
        .eq('farm_id', farmId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError('Packing batch not found.', 404);
    }

    const public_token = newPublicToken();
    const { data, error } = await supabase
      .from('batch_trace_tokens')
      .insert({
        farm_id: farmId,
        subject_type: input.subject_type,
        harvest_batch_id: input.subject_type === 'harvest_batch' ? input.harvest_batch_id : null,
        packing_batch_id: input.subject_type === 'packing_batch' ? input.packing_batch_id : null,
        public_token,
        label: input.label ?? null,
        created_by: user.id,
      })
      .select('id, public_token, subject_type, harvest_batch_id, packing_batch_id, label, created_at')
      .single();
    if (error) throw error;

    await auditFarm(user.id, 'created', 'batch_trace_token', data.id, {
      new: { subject_type: input.subject_type, public_token },
    });

    return NextResponse.json(
      {
        token: data,
        urlPath: `/trace/${data.public_token}`,
      },
      { status: 201 }
    );
  });
}
