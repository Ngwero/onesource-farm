import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { withPermission } from '@/lib/farm/access';
import { auditFarm } from '@/lib/farm/audit';
import { parseBody } from '@/lib/farm/http';
import { cropSchema } from '@/lib/farm/schemas';

export async function GET() {
  return withPermission(undefined, async () => {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('crops')
      .select('*, crop_varieties(id, code, name, status), crop_grades(grade_id)')
      .order('name');
    if (error) throw error;
    return NextResponse.json({ crops: data ?? [] });
  });
}

export async function POST(request: Request) {
  return withPermission('crops.manage', async ({ user }) => {
    const input = await parseBody(request, cropSchema);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('crops')
      .insert({ ...input, created_by: user.id })
      .select('*')
      .single();
    if (error) throw error;

    // New crops start with every active grade; the grading setup can narrow it.
    const { data: grades, error: gradesError } = await supabase
      .from('grades')
      .select('id')
      .eq('status', 'active');
    if (gradesError) throw gradesError;
    if (grades?.length) {
      const { error: linkError } = await supabase
        .from('crop_grades')
        .insert(grades.map((g) => ({ crop_id: data.id, grade_id: g.id })));
      if (linkError) throw linkError;
    }

    await auditFarm(user.id, 'created', 'crop', data.id, { new: input });
    return NextResponse.json({ crop: data }, { status: 201 });
  });
}
