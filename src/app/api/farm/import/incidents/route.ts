import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { importJson, type ImportRowError } from '@/lib/farm/importResult';
import { INCIDENT_STATUSES, INCIDENT_TYPES, SEVERITIES } from '@/lib/farm/schemas';

const rowSchema = z.object({
  block_code: z.string().trim().toUpperCase().min(1).max(20),
  incident_type: z.enum(INCIDENT_TYPES),
  name: z.string().trim().min(1).max(200),
  date_identified: z.string().trim().min(1),
  severity: z.enum(SEVERITIES),
  status: z.enum(INCIDENT_STATUSES).default('open'),
  description: z.string().trim().max(2000).nullable().optional(),
  area_affected_ha: z.number().positive().nullable().optional(),
  action_taken: z.string().trim().max(2000).nullable().optional(),
  treatment: z.string().trim().max(2000).nullable().optional(),
  follow_up_date: z.string().trim().nullable().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  return withPermission('pest.record', async ({ user }) => {
    const input = await parseBody(request, bodySchema);
    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();

    const blockCodes = [...new Set(input.rows.map((r) => r.block_code))];
    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('id, code')
      .eq('farm_id', farmId)
      .in('code', blockCodes);
    if (blocksError) throw blocksError;
    const blockByCode = new Map((blocks ?? []).map((b) => [b.code as string, b.id as string]));

    const created: string[] = [];
    const errors: ImportRowError[] = [];

    for (let i = 0; i < input.rows.length; i++) {
      const row = input.rows[i];
      const blockId = blockByCode.get(row.block_code);
      if (!blockId) {
        errors.push({ row: i + 1, error: `Unknown block code ${row.block_code}` });
        continue;
      }
      if (row.status === 'resolved') {
        errors.push({
          row: i + 1,
          error: 'Use status open/treating/monitoring on import; resolve later in the app',
        });
        continue;
      }
      const { data, error } = await supabase
        .from('pest_disease_incidents')
        .insert({
          farm_id: farmId,
          block_id: blockId,
          incident_type: row.incident_type,
          name: row.name,
          date_identified: row.date_identified,
          severity: row.severity,
          status: row.status,
          description: row.description ?? null,
          area_affected_ha: row.area_affected_ha ?? null,
          action_taken: row.action_taken ?? null,
          treatment: row.treatment ?? null,
          follow_up_date: row.follow_up_date || null,
          reported_by: user.id,
        })
        .select('id, name')
        .single();
      if (error) {
        errors.push({ row: i + 1, error: error.message });
        continue;
      }
      created.push(data.name as string);
      await auditFarm(user.id, 'created', 'pest_disease_incident', data.id, {
        new: { ...row, import: true },
      });
    }

    return importJson(created, errors, 'No incidents were imported.');
  });
}
