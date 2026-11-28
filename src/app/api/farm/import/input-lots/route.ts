import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, rowErrorMessage, type ImportRowError } from '@/lib/farm/importResult';

const rowSchema = z
  .object({
    product_sku: z.string().trim().toUpperCase().min(1).max(32),
    lot_no: z.string().trim().min(1).max(60),
    supplier: z.string().trim().max(120).nullable().optional(),
    received_date: z.string().trim().min(1),
    expiry_date: z.string().trim().nullable().optional(),
    quantity_received: z.number().positive(),
    quantity_remaining: z.number().min(0),
    unit_cost: z.number().min(0).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.quantity_remaining <= v.quantity_received, {
    path: ['quantity_remaining'],
    message: 'Cannot exceed quantity received',
  });

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('procurement.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const skus = [...new Set(input.rows.map((r) => r.product_sku))];
    const { data: products, error: productsError } = await supabase
      .from('input_products')
      .select('id, sku')
      .eq('farm_id', farmId)
      .in('sku', skus);
    if (productsError) throw productsError;
    const productBySku = new Map((products ?? []).map((p) => [p.sku as string, p.id as string]));

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const productId = productBySku.get(row.product_sku);
      if (!productId) {
        errors.push({ row: i + 1, error: `Unknown product code ${row.product_sku}` });
        continue;
      }
      const { data, error } = await supabase
        .from('input_lots')
        .insert({
          farm_id: farmId,
          product_id: productId,
          lot_no: row.lot_no,
          supplier: row.supplier ?? null,
          received_date: row.received_date,
          expiry_date: row.expiry_date || null,
          quantity_received: row.quantity_received,
          quantity_remaining: row.quantity_remaining,
          unit_cost: row.unit_cost ?? null,
          location: row.location ?? null,
          notes: row.notes ?? null,
          created_by: user.id,
        })
        .select('id, lot_no')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: rowErrorMessage(error, `Duplicate lot ${row.lot_no}`),
        });
        continue;
      }
      const { error: moveError } = await supabase.from('input_movements').insert({
        farm_id: farmId,
        product_id: productId,
        lot_id: data.id,
        movement_type: 'receipt',
        quantity: row.quantity_received,
        unit_cost: row.unit_cost ?? null,
        created_by: user.id,
      });
      if (moveError) {
        errors.push({ row: i + 1, error: moveError.message });
        continue;
      }
      created.push(data.lot_no as string);
      await auditFarm(user.id, 'created', 'input_lot', data.id, { new: { ...row, import: true } });
    }

    return importJson(created, errors, 'No lots were imported.');
  });
}
