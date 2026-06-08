import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { createMemo } from '@/lib/memo/service';
import { summarizeMemoFinancials } from '@/lib/memo/financial';
import { fetchUsdToUgxRate } from '@/lib/memo/exchangeRate';
import {
  applyDepartmentMemoListFilter,
  getPrivateMemoStatusIds,
  shouldUseRoleScopedMemoList,
} from '@/lib/memo/orgVisibility';
import { requireAuth, authErrorResponse } from '@/lib/auth/session';
import { memoFromLineForUser } from '@/lib/memo/personLine';
import { fetchMemoIdsForApprovedTab } from '@/lib/memo/approvedMemos';
import { defaultStatusForRole } from '@/lib/auth/memoAccess';
import { canCreateMemo, hasPermission } from '@/lib/auth/rbac';
import type { RoleSlug } from '@/types';
import { isItDepartmentHead } from '@/lib/memo/itRouting';
import {
  amaraFinanceRequestCreatorId,
  financeStepMemoTypeIds,
  usesAmaraFinanceRequestQueue,
  usesChristineFinanceQueue,
} from '@/lib/memo/financeQueueList';
import { memoSearchOrFilter, sanitizeMemoSearchQuery } from '@/lib/memo/search';
import { memoDateRangeForPeriod, parseMemoPeriodFilter } from '@/lib/memo/periodFilter';
import { attachPendingAssigneeNames } from '@/lib/memo/pendingAssignee';

const MEMO_LIST_SELECT = `
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const role = (user.role?.slug || 'staff') as RoleSlug;
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

    if (!status && role !== 'admin' && !searchTerm && !period) {
      const defaultStatus = defaultStatusForRole(role);
      if (defaultStatus && !searchParams.get('memo_type')) {
        status = defaultStatus;
      }
    }

    let query = supabase.from('memos').select(MEMO_LIST_SELECT).limit(limit);

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
    const christineFinanceQueue = usesChristineFinanceQueue(user, status);
    const amaraFinanceQueue = usesAmaraFinanceRequestQueue(user, status);
    const roleScopedList = shouldUseRoleScopedMemoList({
      status,
      view,
      sharedOnly,
      financeStaffQueue: christineFinanceQueue || amaraFinanceQueue,
    });

    if (amaraFinanceQueue) {
      const [creatorId, { data: finType }] = await Promise.all([
        amaraFinanceRequestCreatorId(supabase),
        supabase.from('memo_types').select('id').eq('slug', 'finance_request').maybeSingle(),
      ]);
      if (!creatorId || !finType?.id) {
        return NextResponse.json({ memos: [], financial_summary: null });
      }
      query = query.eq('memo_type_id', finType.id).eq('creator_id', creatorId);
    } else if (christineFinanceQueue) {
      const [typeIds, { data: finType }] = await Promise.all([
        financeStepMemoTypeIds(supabase),
        supabase.from('memo_types').select('id').eq('slug', 'finance_request').maybeSingle(),
      ]);
      if (typeIds.length === 0) {
        return NextResponse.json({ memos: [], financial_summary: null });
      }
      query = query.in('memo_type_id', typeIds);
      if (finType?.id) {
        query = query.or(`memo_type_id.neq.${finType.id},creator_id.neq.${user.id}`);
      }
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
        if (isItDepartmentHead(user)) {
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
      } else if (role === 'business_head') {
        const { data: marketingType } = await supabase
          .from('memo_types')
          .select('id')
          .eq('slug', 'marketing_request')
          .single();
        if (marketingType?.id) query = query.eq('memo_type_id', marketingType.id);
      } else if (role === 'it_checker_first' || role === 'it_checker_second') {
        const { data: itType } = await supabase
          .from('memo_types')
          .select('id')
          .eq('slug', 'it_request')
          .single();
        if (itType) query = query.eq('memo_type_id', itType.id);
      }
    } else if (role !== 'admin') {
      const statusIds = await getPrivateMemoStatusIds(supabase);
      query = applyDepartmentMemoListFilter(
        query,
        user.id,
        user.department_id,
        statusIds
      );
    }

    if (status === 'approved') {
      const approvedMemoIds = await fetchMemoIdsForApprovedTab(supabase, user.id, role);

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

    const usdToUgx = await fetchUsdToUgxRate(supabase);
    const withAssignees = await attachPendingAssigneeNames(supabase, data || [], user.id);
    const memos = withAssignees;
    const financial_summary = summarizeMemoFinancials(memos, usdToUgx);

    return NextResponse.json(
      { memos, financial_summary },
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
