import { NextRequest, NextResponse } from 'next/server';
import { resolveLaunchEmailAppUrl } from '@/lib/auth/appUrl';
import {
  getLaunchAnnouncementPreview,
  sendLaunchAnnouncementBatch,
} from '@/lib/notifications/launchAnnouncement';
import { requireAdmin, authErrorResponse } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const testEmail = request.nextUrl.searchParams.get('testEmail')?.trim().toLowerCase() || undefined;
    const portalUrl = resolveLaunchEmailAppUrl(request);
    const preview = await getLaunchAnnouncementPreview(portalUrl, testEmail);
    return NextResponse.json({ preview });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const testEmail =
      typeof body.testEmail === 'string' ? body.testEmail.trim().toLowerCase() : undefined;

    const portalUrl = resolveLaunchEmailAppUrl(request);
    const result = await sendLaunchAnnouncementBatch({ portalUrl, testEmail });

    return NextResponse.json({
      ...result,
      portalUrl,
      message: testEmail
        ? `Launch email sent to ${testEmail}.`
        : `Launch email sent to ${result.sent} of ${result.total} active staff.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    if (message.includes('SMTP') || message.includes('No active')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return authErrorResponse(err);
  }
}
