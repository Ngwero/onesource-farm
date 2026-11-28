import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, rowErrorMessage, type ImportRowError } from '@/lib/farm/importResult';
import { inputProductSchema } from '@/lib/farm/schemas';

const bodySchema = z.object({
  rows: z.array(inputProductSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('procurement.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const { data, error } = await supabase
        .from('input_products')
        .insert({ ...row, farm_id: farmId, created_by: user.id })
        .select('id, sku')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: rowErrorMessage(error, `Duplicate product code ${row.sku}`),
        });
        continue;
      }
      created.push(data.sku as string);
      await auditFarm(user.id, 'created', 'input_product', data.id, { new: { ...row, import: true } });
    }

    return importJson(created, errors, 'No products were imported.');
  });
}
