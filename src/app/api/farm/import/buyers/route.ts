import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, rowErrorMessage, type ImportRowError } from '@/lib/farm/importResult';
import { buyerSchema } from '@/lib/farm/schemas';

const bodySchema = z.object({
  rows: z.array(buyerSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('buyers.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const { data, error } = await supabase
        .from('buyers')
        .insert({ ...row, farm_id: farmId, created_by: user.id })
        .select('id, code')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: rowErrorMessage(error, `Duplicate buyer code ${row.code}`),
        });
        continue;
      }
      created.push(data.code as string);
      await auditFarm(user.id, 'created', 'buyer', data.id, { new: { ...row, import: true } });
    }

    return importJson(created, errors, 'No buyers were imported.');
  });
}
