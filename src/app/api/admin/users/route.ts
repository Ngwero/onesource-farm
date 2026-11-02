import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';
import { createInvitedUser, portalUrlFromRequest } from '@/lib/admin/inviteUser';
import { handleRouteError, parseBody } from '@/lib/farm/http';
import { inviteUserSchema } from '@/lib/farm/schemas';

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('users')
      .select('*, roles(name, slug), departments(name, code)')
      .order('full_name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = await parseBody(request, inviteUserSchema);
    const result = await createInvitedUser(input, {
      portalUrl: portalUrlFromRequest(request),
      assignedBy: admin.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
