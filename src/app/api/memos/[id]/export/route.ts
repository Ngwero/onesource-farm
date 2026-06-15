import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateMemoPDF } from '@/lib/export/pdf';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanViewMemo } from '@/lib/auth/memoAccess';
import { repairStaleSignatureRecordsForMemo } from '@/lib/signature/sync';
import { buildWorkflowTimelineForMemo } from '@/lib/memo/workflowTimeline';

const MEMO_EXPORT_SELECT = `
  *,
  memo_types(name, slug),
  memo_statuses(name, slug),
  departments(name, code),
  creator:users!creator_id(id, full_name, email, title, signature_path),
  signature_records(*, approver:users!approver_id(signature_path))
`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await assertCanViewMemo(user, id);

    const supabase = createServiceClient();

    await repairStaleSignatureRecordsForMemo(id);

    const { data: memo } = await supabase
      .from('memos')
      .select(MEMO_EXPORT_SELECT)
      .eq('id', id)
      .single();

    if (!memo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: branding } = await supabase.from('branding_settings').select('*').limit(1).single();

    const workflowTimeline = await buildWorkflowTimelineForMemo(memo, user.id);

    const brandingSettings = branding || {
      company_name: 'Rhino Payment Services Limited',
      company_short_name: 'RukaPay',
      company_address:
        'P.O BOX 111498, 2nd Floor, TMT Building\nBukoto-Ntinda Road, Kampala\nTel: +256 (0) 200 244 400\nEmail: info@rukapay.co.ug',
      confidentiality_notice: 'CONFIDENTIAL',
      page_number_style: 'Page {current} of {total}',
    };

    const buffer = await generateMemoPDF(memo, brandingSettings, workflowTimeline);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${memo.reference_number.replace(/\//g, '-')}.pdf"`,
      },
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}
