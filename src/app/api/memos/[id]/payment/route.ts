import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanViewMemo } from '@/lib/auth/memoAccess';
import { updateMemoPaymentStatus } from '@/lib/memo/updatePaymentStatus';
import { paymentMigrationRequiredError } from '@/lib/memo/paymentStatus';
import type { PaymentStatus } from '@/lib/memo/paymentStatus';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await assertCanViewMemo(user, id);

    const body = await request.json();
    const payment_status = body.payment_status as PaymentStatus;
    if (payment_status !== 'not_paid' && payment_status !== 'paid') {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
    }

    const memo = await updateMemoPaymentStatus(user, id, {
      payment_status,
      payment_note: body.payment_note ?? null,
    });

    return NextResponse.json({ memo });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message === paymentMigrationRequiredError()) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === 'Memo not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return authErrorResponse(err);
  }
}
