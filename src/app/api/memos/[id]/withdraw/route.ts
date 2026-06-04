import { NextRequest, NextResponse } from 'next/server';
import { withdrawMemo } from '@/lib/memo/service';
import { requireAuth } from '@/lib/auth/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { reason } = await request.json();

    const result = await withdrawMemo(id, user.id, reason);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Withdraw failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
