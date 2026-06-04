import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/logger';
import type { RoleSlug } from '@/types';

const APPROVER_ROLES: RoleSlug[] = [
  'department_head',
  'business_head',
  'it_checker_first',
  'it_checker_second',
  'finance_reviewer',
  'hr_reviewer',
  'ceo',
  'exco_member',
  'admin',
];

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: asOriginal } = await supabase
      .from('delegations')
      .select(
        '*, delegate:users!delegated_to_id(full_name, email), original:users!original_approver_id(full_name)'
      )
      .eq('original_approver_id', user.id)
      .order('start_date', { ascending: false });

    const { data: asDelegate } = await supabase
      .from('delegations')
      .select(
        '*, delegate:users!delegated_to_id(full_name, email), original:users!original_approver_id(full_name)'
      )
      .eq('delegated_to_id', user.id)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today);

    return NextResponse.json({
      created: asOriginal || [],
      acting_for: asDelegate || [],
    });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const role = user.role?.slug as RoleSlug;
    if (!APPROVER_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Only approvers can set up delegation' },
        { status: 403 }
      );
    }

    const { delegated_to_email, start_date, end_date, reason } = await request.json();
    if (!delegated_to_email || !start_date || !end_date || !reason) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: delegate } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('email', String(delegated_to_email).trim().toLowerCase())
      .eq('is_active', true)
      .single();

    if (!delegate) {
      return NextResponse.json({ error: 'Delegate user not found' }, { status: 404 });
    }
    if (delegate.id === user.id) {
      return NextResponse.json({ error: 'Cannot delegate to yourself' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('delegations')
      .insert({
        original_approver_id: user.id,
        delegated_to_id: delegate.id,
        start_date,
        end_date,
        reason: String(reason).trim(),
        status: 'active',
        created_by: user.id,
      })
      .select('*, delegate:users!delegated_to_id(full_name, email)')
      .single();

    if (error) throw error;

    await logAudit({
      userId: user.id,
      action: 'delegation_created',
      newValues: {
        delegate: delegate.email,
        start_date,
        end_date,
      },
    });

    return NextResponse.json({ delegation: data }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from('delegations')
      .select('original_approver_id')
      .eq('id', id)
      .single();

    if (!existing || existing.original_approver_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('delegations')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit({
      userId: user.id,
      action: 'delegation_cancelled',
      entityId: id,
    });

    return NextResponse.json({ delegation: data });
  } catch (err) {
    return authErrorResponse(err);
  }
}
