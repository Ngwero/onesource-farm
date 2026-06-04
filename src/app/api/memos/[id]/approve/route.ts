import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { processApproval } from '@/lib/memo/service';
import { runApprovalSideEffects } from '@/lib/memo/approvalSideEffects';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanApproveMemo } from '@/lib/auth/memoAccess';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { action, comments } = body;

    await assertCanApproveMemo(user, id);

    const result = await processApproval(id, user.id, { action, comments });

    if (result.sideEffects) {
      after(async () => {
        try {
          await runApprovalSideEffects(result.sideEffects!);
        } catch (err) {
          console.error('Approval side effects failed:', err);
        }
      });
    }

    return NextResponse.json({ status: result.status, partial: result.partial });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Approval failed';
    if (message === 'Forbidden' || message === 'Not authorized to approve this memo') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
