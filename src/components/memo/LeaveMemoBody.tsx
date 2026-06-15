'use client';

import {
  formatLeaveDate,
  getLeavePreviewModel,
  type LeaveDisplaySection,
  type MemoTypeRel,
} from '@/lib/memo/leaveTemplate';
import type { Memo } from '@/types';

export type LeaveMemoBodyProps = {
  memo: Pick<
    Memo,
    'background' | 'financial_implication' | 'justification' | 'recommendation' | 'memo_type'
  > &
    MemoTypeRel;
};

function LeaveDetailBlock({ label, content }: LeaveDisplaySection) {
  return (
    <section className="memo-leave-detail">
      <h3 className="memo-leave-detail__label">{label}</h3>
      <p className="memo-leave-detail__text">{content}</p>
    </section>
  );
}

export function LeaveMemoBody({ memo }: LeaveMemoBodyProps) {
  const { fields, durationDays, showReason, detailSections } = getLeavePreviewModel(memo);

  return (
    <div className="memo-leave">
      <section className="memo-leave-summary" aria-label="Leave summary">
        <div className="memo-leave-summary__head">
          <span className="memo-leave-summary__badge">{fields.leave_type || 'Leave'}</span>
          {durationDays ? (
            <span className="memo-leave-summary__duration">
              {durationDays} calendar day{durationDays === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        <div className="memo-leave-summary__dates">
          <div className="memo-leave-date">
            <span className="memo-leave-date__label">From</span>
            <span className="memo-leave-date__value">
              {fields.leave_start ? formatLeaveDate(fields.leave_start) : '—'}
            </span>
          </div>
          <div className="memo-leave-summary__arrow" aria-hidden>
            →
          </div>
          <div className="memo-leave-date">
            <span className="memo-leave-date__label">To</span>
            <span className="memo-leave-date__value">
              {fields.leave_end ? formatLeaveDate(fields.leave_end) : '—'}
            </span>
          </div>
        </div>
      </section>

      {showReason ? (
        <LeaveDetailBlock label="Reason" content={fields.reason.trim()} />
      ) : null}

      {detailSections.map((section) => (
        <LeaveDetailBlock key={section.label} label={section.label} content={section.content} />
      ))}
    </div>
  );
}
