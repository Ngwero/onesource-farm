import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/farm/access';

export async function GET() {
  return withPermission(undefined, async ({ access }) => NextResponse.json(access));
}
