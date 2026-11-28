import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, rowErrorMessage, type ImportRowError } from '@/lib/farm/importResult';
import { varietySchema } from '@/lib/farm/schemas';

const rowSchema = varietySchema.extend({
  crop_code: z.string().trim().toUpperCase().min(1).max(16),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('crops.manage', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const cropCodes = [...new Set(input.rows.map((r) => r.crop_code))];
    const { data: crops, error: cropsError } = await supabase
      .from('crops')
      .select('id, code')
      .eq('farm_id', farmId)
      .in('code', cropCodes);
    if (cropsError) throw cropsError;
    const cropByCode = new Map((crops ?? []).map((c) => [c.code as string, c.id as string]));

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const cropId = cropByCode.get(row.crop_code);
      if (!cropId) {
        errors.push({ row: i + 1, error: `Unknown crop code ${row.crop_code}` });
        continue;
      }
      const { crop_code: _cropCode, ...variety } = row;
      const { data, error } = await supabase
        .from('crop_varieties')
        .insert({
          ...variety,
          crop_id: cropId,
        })
        .select('id, code')
        .single();
      if (error) {
        errors.push({
          row: i + 1,
          error: rowErrorMessage(error, `Duplicate variety ${row.code} for ${row.crop_code}`),
        });
        continue;
      }
      created.push(`${row.crop_code}/${data.code}`);
      await auditFarm(user.id, 'created', 'crop_variety', data.id, { new: { ...row, import: true } });
    }

    return importJson(created, errors, 'No varieties were imported.');
  });
}
