'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { SIGNATURE_REQUIRED_FOR_MEMO_MESSAGE } from '@/lib/auth/rbac';

export function SignatureRequiredNotice() {
  return (
    <div className="max-w-lg card p-6 border-amber-200 bg-amber-50">
      <div className="flex gap-3">
        <PenLine className="text-amber-700 shrink-0 mt-0.5" size={22} />
        <div>
          <h2 className="font-semibold text-amber-900 mb-1">Signature required</h2>
          <p className="text-sm text-amber-800 mb-4">{SIGNATURE_REQUIRED_FOR_MEMO_MESSAGE}</p>
          <p className="text-sm text-amber-800/90 mb-4">
            Your signature appears on memos under <strong>Prepared By</strong> as the creator.
          </p>
          <Link href="/settings/signature" className="btn-primary inline-flex items-center gap-2 text-sm">
            <PenLine size={16} />
            Upload my signature
          </Link>
        </div>
      </div>
    </div>
  );
}
