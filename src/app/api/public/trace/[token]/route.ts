import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { handleRouteError } from '@/lib/farm/http';
import { loadPublicTrace } from '@/lib/farm/publicTrace';

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
    }
    const supabase = createServiceClient();
    const trace = await loadPublicTrace(supabase, token.trim());
    return NextResponse.json({ trace });
  } catch (err) {
    return handleRouteError(err);
  }
}
