'use client';

import type { PaymentStatus } from '@/types';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  not_paid: 'payment-badge--not-paid',
  paid: 'payment-badge--paid',
};

export function PaymentStatusBadge({ status }: { status?: PaymentStatus | null }) {
  if (!status) return null;

  const label = status === 'paid' ? 'Paid' : 'Not yet paid';

  return (
    <span className={`payment-badge ${PAYMENT_STATUS_CLASS[status]}`}>{label}</span>
  );
}
