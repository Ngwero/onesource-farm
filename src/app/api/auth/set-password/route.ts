import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createAuthVerifyClient } from '@/lib/supabase/authVerify';
import { validateAccountPassword } from '@/lib/auth/passwordStrength';
import { sendWelcomeSignInEmailOnce } from '@/lib/notifications/email';

export async function POST(request: NextRequest) {
  try {
    const { email, current_password, new_password, confirm_password } = await request.json();

    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !current_password || !new_password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (new_password !== confirm_password) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 });
    }

    if (current_password === new_password) {
      return NextResponse.json(
        { error: 'New password must be different from your current password' },
        { status: 400 }
      );
    }

    const validation = validateAccountPassword(String(new_password));
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const verifyClient = createAuthVerifyClient();
    const { data: authData, error: signInError } = await verifyClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: String(current_password),
    });

    if (signInError || !authData.user?.id) {
      return NextResponse.json(
        { error: 'Current password is incorrect. Use your temporary or existing password.' },
        { status: 401 }
      );
    }

    const userId = authData.user.id;
    const admin = createServiceClient();

    const { data: profile } = await admin
      .from('users')
      .select('id, must_set_password, is_active')
      .eq('id', userId)
      .eq('email', normalizedEmail)
      .single();

    if (!profile?.is_active) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: String(new_password),
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: updatedProfile, error: profileUpdateError } = await admin
      .from('users')
      .update({ must_set_password: false })
      .eq('id', userId)
      .select('id, must_set_password')
      .single();

    if (profileUpdateError || !updatedProfile || updatedProfile.must_set_password !== false) {
      console.error('Set password profile update failed:', profileUpdateError, updatedProfile);
      return NextResponse.json(
        { error: 'Password was updated but account status could not be saved. Contact support.' },
        { status: 500 }
      );
    }

    const welcomeEmail = await sendWelcomeSignInEmailOnce(userId);
    if (!welcomeEmail.sent && !welcomeEmail.skipped) {
      console.error('Welcome email after set-password failed:', welcomeEmail.reason);
    }

    return NextResponse.json({
      success: true,
      must_set_password: false,
      welcome_email_sent: welcomeEmail.sent,
    });
  } catch (err) {
    console.error('Set password error:', err);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
