import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, rowErrorMessage, type ImportRowError } from '@/lib/farm/importResult';
import { PAYMENT_STATUSES, SHIPMENT_STATUSES } from '@/lib/farm/schemas';

const rowSchema = z.object({
  shipment_no: z.string().trim().min(1).max(40),
  buyer_code: z.string().trim().toUpperCase().min(1).max(16),
  status: z.enum(SHIPMENT_STATUSES),
  payment_status: z.enum(PAYMENT_STATUSES),
  destination: z.string().trim().max(200).nullable().optional(),
  carrier: z.string().trim().max(120).nullable().optional(),
  booking_ref: z.string().trim().max(80).nullable().optional(),
  awb_bl_number: z.string().trim().max(80).nullable().optional(),
  etd: z.string().trim().nullable().optional(),
  eta: z.string().trim().nullable().optional(),
  invoice_no: z.string().trim().max(80).nullable().optional(),
  invoice_amount: z.number().min(0).nullable().optional(),
  invoice_currency: z.string().trim().toUpperCase().max(3).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('shipments.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const buyerCodes = [...new Set(input.rows.map((r) => r.buyer_code))];
    const { data: buyers, error: buyersError } = await supabase
      .from('buyers')
      .select('id, code')
      .eq('farm_id', farmId)
      .in('code', buyerCodes);
    if (buyersError) throw buyersError;
    const buyerByCode = new Map((buyers ?? []).map((b) => [b.code as string, b.id as string]));

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const buyerId = buyerByCode.get(row.buyer_code);
      if (!buyerId) {
        errors.push({ row: i + 1, error: `Unknown buyer code ${row.buyer_code}` });
        continue;
      }
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          farm_id: farmId,
          buyer_id: buyerId,
          shipment_no: row.shipment_no,
          status: row.status,
          payment_status: row.payment_status,
          destination: row.destination ?? null,
          carrier: row.carrier ?? null,
          booking_ref: row.booking_ref ?? null,
          awb_bl_number: row.awb_bl_number ?? null,
          etd: row.etd || null,
          eta: row.eta || null,
          invoice_no: row.invoice_no ?? null,
          invoice_amount: row.invoice_amount ?? null,
          invoice_currency: row.invoice_currency || 'UGX',
          notes: row.notes ?? null,
          created_by: user.id,
        })
        .select('id, shipment_no')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: rowErrorMessage(error, `Duplicate shipment ${row.shipment_no}`),
        });
        continue;
      }
      created.push(data.shipment_no as string);
      await auditFarm(user.id, 'created', 'shipment', data.id, { new: { ...row, import: true } });
    }

    return importJson(created, errors, 'No shipments were imported.');
  });
}
