import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { HttpError, parseBody } from '@/lib/farm/http';
import { SHIPMENT_LINE_SELECT, SHIPMENT_SELECT } from '@/lib/farm/queries';
import { shipmentLineSchema } from '@/lib/farm/schemas';

type Params = { params: Promise<{ id: string }> };

/** Allocate a packing batch onto a shipment (creates a shipment line). */
export async function POST(request: Request, { params }: Params) {
  return withPermission('shipments.manage', async ({ user }) => {
    const { id } = await params;
    const input = await parseBody(request, shipmentLineSchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status, shipment_no')
      .eq('id', id)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment) throw new HttpError('Shipment not found.', 404);
    if (shipment.status === 'cancelled' || shipment.status === 'delivered') {
      throw new HttpError(`Cannot allocate stock to a ${shipment.status.replace(/_/g, ' ')} shipment.`, 400);
    }

    const { data: batch, error: batchError } = await supabase
      .from('packing_batches')
      .select('id, packing_no, package_count, net_weight_per_package, received_date, qc_status')
      .eq('id', input.packing_batch_id)
      .eq('farm_id', farmId)
      .maybeSingle();
    if (batchError) throw batchError;
    if (!batch) throw new HttpError('Select a packing batch on this farm.', 400, { packing_batch_id: 'Not found' });
    if (!batch.received_date) {
      throw new HttpError(`${batch.packing_no} has not been received into the warehouse yet.`, 400, {
        packing_batch_id: 'Not received',
      });
    }

    const { data: stock } = await supabase
      .from('packing_batch_stock')
      .select('available')
      .eq('packing_batch_id', batch.id)
      .maybeSingle();
    const available = Number(stock?.available ?? 0);
    if (input.package_count > available) {
      throw new HttpError(
        `Only ${available} packages of ${batch.packing_no} are available.`,
        400,
        { package_count: `At most ${available} available` }
      );
    }

    const { data: line, error } = await supabase
      .from('shipment_lines')
      .insert({
        shipment_id: id,
        packing_batch_id: input.packing_batch_id,
        package_count: input.package_count,
        net_weight: input.net_weight,
        notes: input.notes ?? null,
      })
      .select(SHIPMENT_LINE_SELECT)
      .single();
    if (error) throw error;

    await auditFarm(user.id, 'created', 'shipment_line', line.id, {
      new: { shipment_id: id, ...input },
    });

    const { data: updated, error: reloadError } = await supabase
      .from('shipments')
      .select(SHIPMENT_SELECT)
      .eq('id', id)
      .eq('farm_id', farmId)
      .single();
    if (reloadError) throw reloadError;

    return NextResponse.json({ line, shipment: updated }, { status: 201 });
  });
}
