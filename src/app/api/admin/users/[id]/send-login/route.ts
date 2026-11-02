import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import { portalUrlFromRequest, sendUserLoginDetails } from '@/lib/admin/inviteUser';
import { handleRouteError, HttpError } from '@/lib/farm/http';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await sendUserLoginDetails(id, portalUrlFromRequest(request));
    if (!result.emailSent) {
      throw new HttpError(
        `Password was reset, but the email was not sent${result.emailReason ? ` (${result.emailReason})` : ''}. Temporary password: ${result.temporaryPassword}`,
        502
      );
    }
    return NextResponse.json({
      ...result,
      message: `Login details emailed to ${result.user.email}.`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
