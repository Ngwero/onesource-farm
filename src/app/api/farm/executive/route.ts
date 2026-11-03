import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentFarmId, withPermission } from '@/lib/farm/access';
import { loadExecutiveOverview } from '@/lib/farm/executive';

export async function GET() {
  return withPermission(undefined, async ({ can, user }) => {
    // Management, finance, farm viewers, and memo CEO/admin can open the consolidated view.
    const allowed =
      can('profitability.view') ||
      can('reports.view') ||
      can('farm.view') ||
      can('dashboard.view') ||
      user.role?.slug === 'ceo' ||
      user.role?.slug === 'admin';
    if (!allowed) {
      return NextResponse.json({ error: 'You do not have permission to view the executive dashboard.' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const farmId = await getCurrentFarmId();
    const overview = await loadExecutiveOverview(supabase, farmId, can);
    return NextResponse.json(overview);
  });
}
