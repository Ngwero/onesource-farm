import { createServiceClient } from '@/lib/supabase/server';
import { sendNotification, fetchMemoNotificationContext } from '@/lib/notifications/service';

export async function startSlaTracking(
  memoId: string,
  stepOrder: number,
  roleSlug: string,
  assignedTo?: string | null
) {
  const supabase = createServiceClient();

  await supabase
    .from('sla_tracking')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('memo_id', memoId)
    .eq('status', 'active');

  const { data: settings } = await supabase
    .from('sla_settings')
    .select('sla_hours')
    .eq('role_slug', roleSlug)
    .maybeSingle();

  const hours = settings?.sla_hours ?? 24;
  const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  await supabase.from('sla_tracking').insert({
    memo_id: memoId,
    step_order: stepOrder,
    assigned_to: assignedTo || null,
    due_at: dueAt,
    status: 'active',
  });
}

export async function resolveSlaTracking(memoId: string) {
  const supabase = createServiceClient();
  await supabase
    .from('sla_tracking')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('memo_id', memoId)
    .eq('status', 'active');
}

/** Run SLA reminders and breach notifications (call from cron or admin). */
export async function processSlaChecks(): Promise<{ reminded: number; breached: number }> {
  const supabase = createServiceClient();
  const now = new Date();
  let reminded = 0;
  let breached = 0;

  const { data: active } = await supabase
    .from('sla_tracking')
    .select('*, memo:memos(reference_number, subject, creator_id)')
    .eq('status', 'active');

  for (const row of active || []) {
    const due = new Date(row.due_at);
    const memo = row.memo as { reference_number?: string; subject?: string; creator_id?: string } | null;

    if (now > due && !row.breached_at) {
      await supabase
        .from('sla_tracking')
        .update({ breached_at: now.toISOString(), status: 'breached' })
        .eq('id', row.id);
      breached++;

      if (row.assigned_to) {
        const ctx = await fetchMemoNotificationContext(row.memo_id);
        await sendNotification({
          userId: row.assigned_to,
          memoId: row.memo_id,
          title: 'SLA Breached',
          message: `SLA breached for memo ${memo?.reference_number || row.memo_id}. Immediate action required.`,
          type: 'sla_breached',
          context: ctx,
        });
      }
      continue;
    }

    const { data: assignee } = row.assigned_to
      ? await supabase
          .from('users')
          .select('roles(slug)')
          .eq('id', row.assigned_to)
          .maybeSingle()
      : { data: null };

    const rolesJoin = assignee?.roles as { slug?: string } | { slug?: string }[] | null | undefined;
    const roleSlug = Array.isArray(rolesJoin) ? rolesJoin[0]?.slug : rolesJoin?.slug;

    const { data: roleSettings } = roleSlug
      ? await supabase
          .from('sla_settings')
          .select('reminder_hours_before')
          .eq('role_slug', roleSlug)
          .maybeSingle()
      : { data: null };

    const reminderHours = roleSettings?.reminder_hours_before ?? 4;
    const reminderAt = new Date(due.getTime() - reminderHours * 60 * 60 * 1000);

    if (now >= reminderAt && now < due && !row.reminded_at && row.assigned_to) {
      await supabase
        .from('sla_tracking')
        .update({ reminded_at: now.toISOString() })
        .eq('id', row.id);
      reminded++;

      const ctx = await fetchMemoNotificationContext(row.memo_id);
      await sendNotification({
        userId: row.assigned_to,
        memoId: row.memo_id,
        title: 'SLA Reminder',
        message: `Reminder: memo ${memo?.reference_number || row.memo_id} is due by ${due.toLocaleString()}.`,
        type: 'sla_reminder',
        context: ctx,
      });
    }
  }

  return { reminded, breached };
}
