import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { submitMemo } from '@/lib/memo/service';
import { runSubmitMemoSideEffects } from '@/lib/memo/submitSideEffects';
import { hasMemoPatchFields, patchEditableMemo } from '@/lib/memo/updateDraft';
import { requireAuth } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    let body: Record<string, unknown> | null = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    if (body && hasMemoPatchFields(body)) {
      await patchEditableMemo(
        user,
        id,
        body,
        (body.change_reason as string) || 'Updated before submit'
      );
    } else {
      const supabase = createServiceClient();
      const { data: memo } = await supabase
        .from('memos')
        .select('creator_id')
        .eq('id', id)
        .single();

      if (!memo || memo.creator_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const result = await submitMemo(id, user.id);

    after(async () => {
      try {
        await runSubmitMemoSideEffects(result.sideEffects);
      } catch (err) {
        console.error('Submit side effects failed:', err);
      }
    });

    return NextResponse.json({ success: true, status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Submit failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
