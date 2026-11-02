'use client';

import type { Memo, BrandingSettings } from '@/types';
import {
  MEMO_VISION_STATEMENT,
  formatMemoDate,
  getCompanyContactLines,
} from '@/lib/memo/coverLetterDefaults';
import { isLeaveMemo } from '@/lib/memo/leaveTemplate';
import { LeaveMemoBody, type LeaveMemoBodyProps } from '@/components/memo/LeaveMemoBody';
import { MemoWorkflowApprovals } from '@/components/memo/MemoWorkflowApprovals';
import type { WorkflowTimelineStep } from '@/lib/memo/workflowTimelineTypes';

interface MemoTemplateProps {
  memo: Memo;
  branding?: BrandingSettings;
  workflowSteps?: WorkflowTimelineStep[];
}

const BODY_SECTIONS = [
  { key: 'background', label: 'Background' },
  { key: 'financial_implication', label: 'Financial Implication' },
  { key: 'justification', label: 'Justification' },
  { key: 'recommendation', label: 'Recommendation' },
] as const;

export function MemoTemplate({ memo, branding, workflowSteps = [] }: MemoTemplateProps) {
  const companyName = branding?.company_name || 'ONESOURCE FARM';
  const contactLines = getCompanyContactLines(branding);
  const logoSrc = branding?.logo_path
    ? `/api/files/${branding.logo_path}`
    : '/onesource-logo-white.png';
  const leaveMemo = isLeaveMemo(memo as LeaveMemoBodyProps['memo']);

  const metaFields = [
    { label: 'From', value: memo.memo_from },
    { label: 'Thru', value: memo.memo_thru },
    { label: 'To', value: memo.memo_to },
    { label: 'Date', value: formatMemoDate(memo.memo_date) },
    { label: 'Subject', value: memo.subject, wide: true },
  ].filter((f) => f.value);

  return (
    <article className="memo-doc">
      <header className="memo-doc-header">
        <div className="memo-doc-header-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" className="memo-doc-logo" />
        </div>
        <div className="memo-doc-header-info">
          <p className="memo-doc-company">{companyName.toUpperCase()}</p>
          <ul className="memo-doc-contact">
            {contactLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </header>

      <div className="memo-doc-body">
        <div className="memo-doc-hero">
          <div>
            <p className="memo-doc-eyebrow">Official correspondence</p>
            <h1 className="memo-doc-title">{leaveMemo ? 'Leave Application' : 'Internal Memo'}</h1>
          </div>
          {memo.reference_number ? (
            <div className="memo-doc-ref-badge">
              <span className="memo-doc-ref-label">Reference</span>
              <span className="memo-doc-ref-value">{memo.reference_number}</span>
            </div>
          ) : null}
        </div>

        {metaFields.length > 0 ? (
          <section className="memo-doc-routing" aria-label="Memo routing">
            <dl className="memo-doc-routing-grid">
              {metaFields.map(({ label, value, wide }) => (
                <div
                  key={label}
                  className={`memo-doc-field${wide ? ' memo-doc-field--wide' : ''}`}
                >
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <div className="memo-doc-sections">
          {leaveMemo ? (
            <LeaveMemoBody memo={memo as LeaveMemoBodyProps['memo']} />
          ) : (
            BODY_SECTIONS.map(({ key, label }) => {
              const content = memo[key];
              if (!content) return null;
              return (
                <section key={key} className="memo-doc-block">
                  <h2 className="memo-doc-block-title">{label}</h2>
                  <p className="memo-doc-block-text">{content}</p>
                </section>
              );
            })
          )}
        </div>

        {workflowSteps.length > 0 || memo.creator ? (
          <MemoWorkflowApprovals steps={workflowSteps} memo={memo} />
        ) : null}

        <footer className="memo-doc-footer">
          <p>{MEMO_VISION_STATEMENT}</p>
        </footer>
      </div>
    </article>
  );
}
