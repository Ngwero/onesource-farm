'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';
import {
  SIGNATURE_REQUIRED_FOR_APPROVAL_MESSAGE,
  SIGNATURE_REQUIRED_FOR_MEMO_MESSAGE,
} from '@/lib/auth/rbac';

type SignatureNoticeVariant = 'create' | 'approve';

const COPY: Record<
  SignatureNoticeVariant,
  { title: string; message: string; detail: string }
> = {
  create: {
    title: 'Signature required',
    message: SIGNATURE_REQUIRED_FOR_MEMO_MESSAGE,
    detail: 'Your signature appears on memos under Prepared By as the creator.',
  },
  approve: {
    title: 'Upload your signature before approving',
    message: SIGNATURE_REQUIRED_FOR_APPROVAL_MESSAGE,
    detail:
      'Your signature is stamped on the memo under Checked By, Reviewed By, or Approved By when you approve.',
  },
};

export function SignatureRequiredNotice({
  variant = 'create',
  compact = false,
}: {
  variant?: SignatureNoticeVariant;
  compact?: boolean;
}) {
  const { title, message, detail } = COPY[variant];

  return (
    <div
      className={`border border-amber-200 bg-amber-50 rounded-lg ${
        compact ? 'p-3 mb-3' : 'max-w-lg card p-6'
      }`}
    >
      <div className="flex gap-3">
        <PenLine className="text-amber-700 shrink-0 mt-0.5" size={compact ? 18 : 22} />
        <div>
          <h2 className={`font-semibold text-amber-900 ${compact ? 'text-sm mb-1' : 'mb-1'}`}>
            {title}
          </h2>
          <p className={`text-amber-800 ${compact ? 'text-xs mb-2' : 'text-sm mb-4'}`}>
            {message}
          </p>
          <p className={`text-amber-800/90 ${compact ? 'text-xs mb-2' : 'text-sm mb-4'}`}>
            {detail}
          </p>
          <Link
            href="/settings/signature"
            className={`btn-primary inline-flex items-center gap-2 ${
              compact ? 'text-xs px-3 py-1.5' : 'text-sm'
            }`}
          >
            <PenLine size={compact ? 14 : 16} />
            Upload my signature
          </Link>
        </div>
      </div>
    </div>
  );
}
