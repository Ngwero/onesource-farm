'use client';

import type { Memo, BrandingSettings, SignatureRecord } from '@/types';
import { SignatureImage } from './SignatureImage';
import {
  MEMO_VISION_STATEMENT,
  formatMemoDate,
  formatSignerLine,
  getCompanyContactLines,
} from '@/lib/memo/coverLetterDefaults';
import { formatCurrency, getMemoFinancialAmount } from '@/lib/memo/financial';
import { getLeaveDisplaySections, isLeaveMemo } from '@/lib/memo/leaveTemplate';
import { resolveSignatureForBlock } from '@/lib/memo/signatureBlocks';

interface MemoTemplateProps {
  memo: Memo;
  branding?: BrandingSettings;
  signatures?: SignatureRecord[];
}

const BODY_SECTIONS = [
  { key: 'background', label: 'Background' },
  { key: 'financial_implication', label: 'Financial Implication' },
  { key: 'justification', label: 'Justification' },
  { key: 'recommendation', label: 'Recommendation' },
] as const;

const SIGNATURE_BLOCKS = [
  { label: 'Prepared By', type: 'prepared' as const },
  { label: 'Checked By', type: 'checked' as const },
  { label: 'Reviewed By', type: 'reviewed' as const },
  { label: 'Approved By', type: 'approved' as const },
];

export function MemoTemplate({ memo, branding, signatures = [] }: MemoTemplateProps) {
  const companyName = branding?.company_name || 'RHINO PAYMENT SERVICES LIMITED';
  const contactLines = getCompanyContactLines(branding);
  const logoSrc = branding?.logo_path
    ? `/api/files/${branding.logo_path}`
    : '/rukapay-logo-white.png';
  const leaveMemo = isLeaveMemo(memo);
  const leaveSections = leaveMemo ? getLeaveDisplaySections(memo) : [];

  const metaFields = [
    { label: 'From', value: memo.memo_from },
    { label: 'Thru', value: memo.memo_thru },
    { label: 'To', value: memo.memo_to },
    { label: 'Date', value: formatMemoDate(memo.memo_date) },
    { label: 'Subject', value: memo.subject, wide: true },
  ].filter((f) => f.value);

  const financialAmount = getMemoFinancialAmount(memo.financial_implication);

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
          {leaveMemo
            ? leaveSections.map(({ label, content }) => (
                <section key={label} className="memo-doc-block">
                  <h2 className="memo-doc-block-title">{label}</h2>
                  <p className="memo-doc-block-text">{content}</p>
                </section>
              ))
            : BODY_SECTIONS.map(({ key, label }) => {
                const content = memo[key];
                if (!content) return null;
                return (
                  <section key={key} className="memo-doc-block">
                    <h2 className="memo-doc-block-title">
                      {label}
                      {key === 'financial_implication' && financialAmount ? (
                        <span className="memo-doc-financial-badge">
                          {formatCurrency(financialAmount)}
                        </span>
                      ) : null}
                    </h2>
                    <p className="memo-doc-block-text">{content}</p>
                  </section>
                );
              })}
        </div>

        <section className="memo-doc-approvals" aria-label="Approvals and signatures">
          <h2 className="memo-doc-approvals-heading">Approvals</h2>
          <div className="memo-doc-approval-grid">
            {SIGNATURE_BLOCKS.map(({ label, type }) => {
              const sig = resolveSignatureForBlock(type, signatures, {
                creator_id: memo.creator_id,
                creator: memo.creator
                  ? {
                      id: memo.creator.id,
                      full_name: memo.creator.full_name,
                      title: memo.creator.title,
                      signature_path: memo.creator.signature_path,
                    }
                  : null,
                submitted_at: memo.submitted_at,
                created_at: memo.created_at,
              });
              return (
                <div
                  key={type}
                  className={`memo-doc-approval-card${sig ? '' : ' memo-doc-approval-card--empty'}`}
                >
                  <span className="memo-doc-approval-role">{label}</span>
                  {sig?.signature_path ? (
                    <div className="memo-doc-approval-sig">
                      <SignatureImage
                        src={`/api/files/${sig.signature_path}`}
                        alt={`${label} signature`}
                      />
                    </div>
                  ) : (
                    <div className="memo-doc-approval-pending" aria-hidden />
                  )}
                  {sig ? (
                    <p className="memo-doc-approval-name">
                      {formatSignerLine(sig.approver_name, sig.approver_title)}
                    </p>
                  ) : (
                    <p className="memo-doc-approval-name memo-doc-approval-name--muted">
                      Pending
                    </p>
                  )}
                  {sig?.delegation_note ? (
                    <p className="memo-doc-approval-note">{sig.delegation_note}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="memo-doc-footer">
          <p>{MEMO_VISION_STATEMENT}</p>
        </footer>
      </div>
    </article>
  );
}
