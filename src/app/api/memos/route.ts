import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createMemo } from '@/lib/memo/service';
import {
  applyDepartmentMemoListFilter,
  getPrivateMemoStatusIds,
  shouldUseRoleScopedMemoList,
} from '@/lib/memo/orgVisibility';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { isDesignatedChairman } from '@/lib/memo/designatedUsers';
import { memoFromLineForUser } from '@/lib/memo/personLine';
import { fetchMemoIdsForApprovedTab } from '@/lib/memo/approvedMemos';
import { defaultStatusForUser } from '@/lib/auth/memoAccess';
import { isBusinessHead } from '@/lib/memo/marketingRouting';
import { canCreateMemo, hasPermission } from '@/lib/auth/rbac';
import type { RoleSlug } from '@/types';
import { isItDepartmentHead } from '@/lib/memo/itRouting';
import {
  isInterdeptFinanceReviewer,
  isSharedFinanceApprover,
} from '@/lib/memo/financeMemoRouting';
import {
  financeQueueExcludeOwnFinanceRequestFilter,
  financeStepMemoTypeIds,
  usesSharedFinanceQueue,
} from '@/lib/memo/financeQueueList';
import { memoSearchOrFilter, sanitizeMemoSearchQuery } from '@/lib/memo/search';
import { memoDateRangeForPeriod, parseMemoPeriodFilter } from '@/lib/memo/periodFilter';
import { attachPendingAssigneeNames } from '@/lib/memo/pendingAssignee';
import { fetchMemoIdsInvolvingUser } from '@/lib/memo/memosInvolvingUser';
import { attachCanEditToMemos } from '@/lib/memo/memoEditAccess';
import {
  hasPaymentTrackingColumns,
  memoTypeTracksPayment,
  memoTypeSlugFromMemo,
  memoStatusSlugFromMemo,
} from '@/lib/memo/paymentStatus';

const MEMO_LIST_SELECT_BASE = `
  id,
  reference_number,
  subject,
  memo_date,
  created_at,
  updated_at,
  submitted_at,
  creator_id,
  department_id,
  status_id,
  current_step_order,
  memo_type_id,
  importance_level,
  financial_implication,
  requires_finance,
  memo_types(name, slug),
  memo_statuses(name, slug),
  departments(name, code),
  creator:users!creator_id(full_name, email)
`;

async function memoListSelect(supabase: ReturnType<typeof createServiceClient>) {
  if (await hasPaymentTrackingColumns(supabase)) {
    return `${MEMO_LIST_SELECT_BASE.trim()},\n  payment_status`;
  }
  return MEMO_LIST_SELECT_BASE.trim();
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const role = (user.role?.slug || 'staff') as RoleSlug;
    const chairmanViewer = isDesignatedChairman(user);
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    let status = searchParams.get('status');
    const view = searchParams.get('view');
    const department = searchParams.get('department');
    const memoType = searchParams.get('memo_type');
    const creator = searchParams.get('creator');
    const searchRaw = searchParams.get('search') || searchParams.get('q');
    const searchTerm = sanitizeMemoSearchQuery(searchRaw);
    const period = parseMemoPeriodFilter(
      searchParams.get('year'),
      searchParams.get('month')
    );
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const paymentStatusFilter = searchParams.get('payment_status');
    const christinePaymentQueue =
      isInterdeptFinanceReviewer(user) &&
      status === 'approved' &&
      (paymentStatusFilter === 'not_paid' || paymentStatusFilter === 'paid');

    if (chairmanViewer && status === 'deleted') {
      return NextResponse.json({ memos: [], financial_summary: null });
    }

    if (!status && role !== 'admin' && !chairmanViewer && !searchTerm && !period) {
      const defaultStatus = defaultStatusForUser(user);
      if (defaultStatus && !searchParams.get('memo_type')) {
        status = defaultStatus;
      }
    }

    const listSelect = await memoListSelect(supabase);
    let query = supabase.from('memos').select(listSelect).limit(limit);

    if (period) {
      const { start, endExclusive } = memoDateRangeForPeriod(period);
      query = query
        .gte('memo_date', start)
        .lt('memo_date', endExclusive)
        .order('memo_date', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const sharedOnly = searchParams.get('shared') === '1';
    const mineView = view === 'mine';
    const involvingView = view === 'involving';
    const sharedFinanceApprover = isSharedFinanceApprover(user);
    const sharedFinanceQueue = usesSharedFinanceQueue(user, status);
    const financeInvolvingScope =
      sharedFinanceApprover &&
      !mineView &&
      !sharedOnly &&
      !sharedFinanceQueue &&
      !christinePaymentQueue &&
      !department &&
      !memoType &&
      !creator &&
      (involvingView ||
        (!status && !period) ||
        (Boolean(searchTerm) && !status));
    const roleScopedList =
      !mineView &&
      shouldUseRoleScopedMemoList({
        status,
        view,
        sharedOnly,
        financeStaffQueue: sharedFinanceQueue,
      });

    if (mineView) {
      const statusIds = await getPrivateMemoStatusIds(supabase);
      query = query.eq('creator_id', user.id);
      if (statusIds.deletedId) {
        query = query.neq('status_id', statusIds.deletedId);
      }
    } else if (financeInvolvingScope) {
      const ids = await fetchMemoIdsInvolvingUser(supabase, user);
      if (ids.length === 0) {
        return NextResponse.json({
          memos: [],
          financial_summary: null,
          payment_tracking_enabled: await hasPaymentTrackingColumns(supabase),
        });
      }
      query = query.in('id', ids);
      const statusIds = await getPrivateMemoStatusIds(supabase);
      if (statusIds.deletedId) {
        query = query.neq('status_id', statusIds.deletedId);
      }
    } else if (sharedFinanceQueue) {
      const [typeIds, { data: finType }] = await Promise.all([
        financeStepMemoTypeIds(supabase),
        supabase.from('memo_types').select('id').eq('slug', 'finance_request').maybeSingle(),
      ]);
      if (typeIds.length === 0) {
        return NextResponse.json({ memos: [], financial_summary: null });
      }
      query = query.in('memo_type_id', typeIds);
      const excludeOwn = financeQueueExcludeOwnFinanceRequestFilter(finType?.id, user.id);
      if (excludeOwn) {
        query = query.or(excludeOwn);
      }
    } else if (christinePaymentQueue) {
      // Payment lists — full finance-step scope applied below (no department filter).
    } else if (
      (role === 'business_head' || isBusinessHead(user)) &&
      (status === 'pending_business_head' || memoType === 'marketing_request')
    ) {
      const { data: marketingType } = await supabase
        .from('memo_types')
        .select('id')
        .eq('slug', 'marketing_request')
        .single();
      if (marketingType?.id) query = query.eq('memo_type_id', marketingType.id);
    } else if (sharedOnly) {
      const { data: sharedRows } = await supabase
        .from('shared_memo_access')
        .select('memo_id')
        .eq('shared_with', user.id);
      const sharedIds = (sharedRows || []).map((r) => r.memo_id as string);
      if (sharedIds.length === 0) {
        return NextResponse.json({ memos: [], financial_summary: null });
      }
      query = query.in('id', sharedIds);
    } else if (roleScopedList) {
      if (role === 'department_head' && user.department_id) {
        if (
          isBusinessHead(user) &&
          (status === 'pending_business_head' || memoType === 'marketing_request')
        ) {
          // Marketing queue — memos are often from MKT, not the business head's BD department.
        } else if (isItDepartmentHead(user)) {
          const [{ data: itType }, { data: pendingDeptHead }] = await Promise.all([
            supabase.from('memo_types').select('id').eq('slug', 'it_request').single(),
            supabase
              .from('memo_statuses')
              .select('id')
              .eq('slug', 'pending_department_head')
              .single(),
          ]);
          if (itType?.id && pendingDeptHead?.id) {
            query = query.or(
              `department_id.eq.${user.department_id},and(memo_type_id.eq.${itType.id},status_id.eq.${pendingDeptHead.id})`
            );
          } else {
            query = query.eq('department_id', user.department_id);
          }
        } else {
          query = query.eq('department_id', user.department_id);
        }
      } else if (role === 'it_checker_first' || role === 'it_checker_second') {
        const { data: itType } = await supabase
          .from('memo_types')
          .select('id')
          .eq('slug', 'it_request')
          .single();
        if (itType) query = query.eq('memo_type_id', itType.id);
      } else if (role === 'staff') {
        const statusIds = await getPrivateMemoStatusIds(supabase);
        query = applyDepartmentMemoListFilter(
          query,
          user.id,
          user.department_id,
          statusIds
        );
      }
    } else if (role !== 'admin' && !chairmanViewer) {
      const statusIds = await getPrivateMemoStatusIds(supabase);
      query = applyDepartmentMemoListFilter(
        query,
        user.id,
        user.department_id,
        statusIds
      );
    }

    if (chairmanViewer) {
      const statusIds = await getPrivateMemoStatusIds(supabase);
      if (statusIds.deletedId) {
        query = query.neq('status_id', statusIds.deletedId);
      }
      if (!status && statusIds.draftId) {
        query = query.or(`creator_id.eq.${user.id},status_id.neq.${statusIds.draftId}`);
      }
    }

    if (status === 'approved') {
      if (christinePaymentQueue) {
        const [typeIds, { data: approvedStatus }] = await Promise.all([
          financeStepMemoTypeIds(supabase),
          supabase.from('memo_statuses').select('id').eq('slug', 'approved').single(),
        ]);
        if (typeIds.length === 0 || !approvedStatus?.id) {
          return NextResponse.json({ memos: [], financial_summary: null });
        }
        query = query
          .in('memo_type_id', typeIds)
          .eq('status_id', approvedStatus.id);
        if (paymentStatusFilter && (await hasPaymentTrackingColumns(supabase))) {
          if (paymentStatusFilter === 'not_paid') {
            query = query.or('payment_status.eq.not_paid,payment_status.is.null');
          } else {
            query = query.eq('payment_status', paymentStatusFilter);
          }
        }
      } else {
        const approvedMemoIds = await fetchMemoIdsForApprovedTab(
          supabase,
          user.id,
          role,
          user
        );

        if (approvedMemoIds !== null) {
          if (approvedMemoIds.length === 0) {
            return NextResponse.json({ memos: [], financial_summary: null });
          }
          query = query.in('id', approvedMemoIds);
        } else {
          const { data: statusRow } = await supabase
            .from('memo_statuses')
            .select('id')
            .eq('slug', 'approved')
            .single();
          if (statusRow) query = query.eq('status_id', statusRow.id);
        }
      }
    } else if (status) {
      const { data: statusRow } = await supabase
        .from('memo_statuses')
        .select('id')
        .eq('slug', status)
        .single();
      if (statusRow) query = query.eq('status_id', statusRow.id);
      if (status === 'draft' && role !== 'admin') {
        query = query.eq('creator_id', user.id);
      }
    }

    if (view === 'active' && role === 'staff') {
      const { data: excluded } = await supabase
        .from('memo_statuses')
        .select('id')
        .in('slug', ['draft', 'approved', 'rejected', 'withdrawn', 'deleted', 'archived']);
      const excludedIds = (excluded || []).map((r) => r.id);
      if (excludedIds.length > 0) {
        query = query.not('status_id', 'in', `(${excludedIds.join(',')})`);
      }
    }

    if (department) query = query.eq('department_id', department);
    if (memoType) {
      const { data: typeRow } = await supabase
        .from('memo_types')
        .select('id')
        .eq('slug', memoType)
        .single();
      if (typeRow) query = query.eq('memo_type_id', typeRow.id);
    }
    if (creator) query = query.eq('creator_id', creator);

    if (searchTerm) {
      const textFilter = memoSearchOrFilter(searchTerm);
      const { data: matchingCreators } = await supabase
        .from('users')
        .select('id')
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(25);

      const creatorIds = (matchingCreators || []).map((u) => u.id as string);
      if (creatorIds.length > 0) {
        query = query.or(`${textFilter},creator_id.in.(${creatorIds.join(',')})`);
      } else {
        query = query.or(textFilter);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const withAssignees = await attachPendingAssigneeNames(
      supabase,
      (data ?? []) as unknown as Parameters<typeof attachPendingAssigneeNames>[1],
      user.id
    );

    const paymentTrackingEnabled = await hasPaymentTrackingColumns(supabase);
    const withPayment = withAssignees.map((memo) => {
      if (!paymentTrackingEnabled) return memo;
      const statusSlug = memoStatusSlugFromMemo(memo);
      const typeSlug = memoTypeSlugFromMemo(memo);
      if (
        statusSlug === 'approved' &&
        memoTypeTracksPayment(typeSlug) &&
        !(memo as { payment_status?: string | null }).payment_status
      ) {
        return { ...memo, payment_status: 'not_paid' as const };
      }
      return memo;
    });
    const memos = await attachCanEditToMemos(supabase, user, withPayment);

    return NextResponse.json(
      { memos, financial_summary: null, payment_tracking_enabled: paymentTrackingEnabled },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const { department_id, memo_type_id, ...input } = body;

    const role = (user.role?.slug || 'staff') as RoleSlug;
    if (!user.role?.slug) {
      return NextResponse.json({ error: 'Your role cannot create memos' }, { status: 403 });
    }
    if (!canCreateMemo(role) && !hasPermission(role, '*')) {
      return NextResponse.json({ error: 'Your role cannot create memos' }, { status: 403 });
    }

    if (!memo_type_id) {
      return NextResponse.json({ error: 'Memo type required' }, { status: 400 });
    }

    const deptId = department_id || user.department_id;
    if (!deptId) {
      return NextResponse.json(
        { error: 'Select which department this memo is for' },
        { status: 400 }
      );
    }

    const memo = await createMemo(user.id, deptId, {
      memo_type_id,
      ...input,
      memo_from: memoFromLineForUser(user),
    });
    return NextResponse.json({ memo }, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
