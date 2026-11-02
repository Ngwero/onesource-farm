import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/farm/access';
import { HttpError } from '@/lib/farm/http';
import { portalUrlFromRequest, sendUserLoginDetails } from '@/lib/admin/inviteUser';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withPermission('admin.users', async () => {
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
  });
}
