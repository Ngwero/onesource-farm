import { NextRequest, NextResponse } from 'next/server';
import { readFile } from '@/lib/storage';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { assertCanViewMemo } from '@/lib/auth/memoAccess';
import { createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/types';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

async function assertFileAccess(user: User, relativePath: string) {
  if (relativePath.includes('..')) throw new Error('Forbidden');

  const supabase = createServiceClient();
  const normalized = relativePath.replace(/\\/g, '/');

  if (normalized.startsWith('logos/')) return;

  const { data: attachment } = await supabase
    .from('memo_attachments')
    .select('memo_id')
    .eq('file_path', relativePath)
    .maybeSingle();

  if (attachment?.memo_id) {
    await assertCanViewMemo(user, attachment.memo_id);
    return;
  }

  const { data: signatureOwner } = await supabase
    .from('users')
    .select('id')
    .eq('signature_path', relativePath)
    .maybeSingle();

  if (signatureOwner) {
    if (signatureOwner.id === user.id || user.role?.slug === 'admin') return;

    const { data: sigRecord } = await supabase
      .from('signature_records')
      .select('memo_id')
      .eq('signature_path', relativePath)
      .limit(1)
      .maybeSingle();

    if (sigRecord?.memo_id) {
      await assertCanViewMemo(user, sigRecord.memo_id);
      return;
    }
    throw new Error('Forbidden');
  }

  throw new Error('File not found');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await requireAuth();
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join('/');

    await assertFileAccess(user, relativePath);

    const buffer = await readFile(relativePath);
    const ext = path.extname(relativePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File not found';
    if (message === 'Forbidden') {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
