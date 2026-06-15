-- Payment tracking for approved memos that went through finance (Christine marks paid / not yet paid).

ALTER TABLE memos
  ADD COLUMN IF NOT EXISTS payment_status TEXT
    CHECK (payment_status IS NULL OR payment_status IN ('not_paid', 'paid')),
  ADD COLUMN IF NOT EXISTS payment_note TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_memos_payment_status ON memos(payment_status)
  WHERE payment_status IS NOT NULL;

-- Existing fully approved finance-step memos start as not yet paid.
UPDATE memos m
SET payment_status = 'not_paid',
    updated_at = NOW()
FROM memo_statuses ms,
     memo_types mt
WHERE m.status_id = ms.id
  AND m.memo_type_id = mt.id
  AND ms.slug = 'approved'
  AND mt.slug IN (
    'payment_request',
    'procurement_request',
    'finance_request',
    'hr_request',
    'marketing_request',
    'it_request',
    'general_internal'
  )
  AND m.payment_status IS NULL;
