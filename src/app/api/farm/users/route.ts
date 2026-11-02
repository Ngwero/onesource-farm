import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { inviteUserSchema } from '@/lib/farm/schemas';
import { createInvitedUser, portalUrlFromRequest } from '@/lib/admin/inviteUser';

/** Active users for supervisor / manager pickers. */
export async function GET() {
  return withPermission(undefined, async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, title')
      .eq('is_active', true)
      .order('full_name');
    if (error) throw error;
    return NextResponse.json({ users: data ?? [] });
  });
}

/** Create a staff account, optionally assign farm roles, and email login details. */
export async function POST(request: Request) {
  return withPermission('admin.users', async ({ user }) => {
    const input = await parseBody(request, inviteUserSchema);
    const result = await createInvitedUser(input, {
      portalUrl: portalUrlFromRequest(request),
      assignedBy: user.id,
    });
    await auditFarm(user.id, 'created', 'user', result.user.id, { new: { email: result.user.email } });
    return NextResponse.json(result, { status: 201 });
  });
}
