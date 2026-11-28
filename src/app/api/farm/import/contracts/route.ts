import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, rowErrorMessage, type ImportRowError } from '@/lib/farm/importResult';
import { CONTRACT_STATUSES } from '@/lib/farm/schemas';

const rowSchema = z.object({
  buyer_code: z.string().trim().toUpperCase().min(1).max(16),
  contract_no: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  start_date: z.string().trim().min(1),
  end_date: z.string().trim().nullable().optional(),
  agreed_quantity: z.number().positive(),
  quantity_unit: z.string().trim().min(1).max(20),
  unit_price: z.number().min(0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  status: z.enum(CONTRACT_STATUSES),
  crop_code: z.string().trim().toUpperCase().nullable().optional(),
  specifications: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('contracts.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const buyerCodes = [...new Set(input.rows.map((r) => r.buyer_code))];
    const cropCodes = [...new Set(input.rows.map((r) => r.crop_code).filter(Boolean))] as string[];

    const [buyersRes, cropsRes] = await Promise.all([
      supabase.from('buyers').select('id, code').eq('farm_id', farmId).in('code', buyerCodes),
      cropCodes.length
        ? supabase.from('crops').select('id, code').eq('farm_id', farmId).in('code', cropCodes)
        : Promise.resolve({ data: [] as { id: string; code: string }[], error: null }),
    ]);
    if (buyersRes.error) throw buyersRes.error;
    if (cropsRes.error) throw cropsRes.error;

    const buyerByCode = new Map((buyersRes.data ?? []).map((b) => [b.code as string, b.id as string]));
    const cropByCode = new Map((cropsRes.data ?? []).map((c) => [c.code as string, c.id as string]));

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const buyerId = buyerByCode.get(row.buyer_code);
      if (!buyerId) {
        errors.push({ row: i + 1, error: `Unknown buyer code ${row.buyer_code}` });
        continue;
      }
      let cropId: string | null = null;
      if (row.crop_code) {
        cropId = cropByCode.get(row.crop_code) ?? null;
        if (!cropId) {
          errors.push({ row: i + 1, error: `Unknown crop code ${row.crop_code}` });
          continue;
        }
      }
      const { data, error } = await supabase
        .from('buyer_contracts')
        .insert({
          farm_id: farmId,
          buyer_id: buyerId,
          crop_id: cropId,
          contract_no: row.contract_no,
          title: row.title,
          start_date: row.start_date,
          end_date: row.end_date || null,
          agreed_quantity: row.agreed_quantity,
          quantity_unit: row.quantity_unit,
          unit_price: row.unit_price,
          currency: row.currency,
          status: row.status,
          specifications: row.specifications ?? null,
          notes: row.notes ?? null,
          created_by: user.id,
        })
        .select('id, contract_no')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: rowErrorMessage(error, `Duplicate contract ${row.contract_no}`),
        });
        continue;
      }
      created.push(data.contract_no as string);
      await auditFarm(user.id, 'created', 'buyer_contract', data.id, { new: { ...row, import: true } });
    }

    return importJson(created, errors, 'No contracts were imported.');
  });
}
