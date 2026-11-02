import { logAudit } from '@/lib/audit/logger';

export async function auditFarm(
  userId: string,
  change: 'created' | 'updated' | 'deleted',
  entityType: string,
  entityId: string,
  values?: { old?: Record<string, unknown>; new?: Record<string, unknown> }
) {
  await logAudit({
    userId,
    action: `farm_record_${change}`,
    entityType,
    entityId,
    oldValues: values?.old,
    newValues: values?.new,
  });
}
