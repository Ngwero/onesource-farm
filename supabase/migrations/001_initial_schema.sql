-- OneSource - Initial Schema
-- Rhino Payment Services Limited

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  title TEXT,
  department_id UUID REFERENCES departments(id),
  role_id UUID REFERENCES roles(id) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  signature_path TEXT,
  signature_uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXCO group members
CREATE TABLE exco_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  position TEXT NOT NULL CHECK (position IN ('CEO', 'CBDO', 'CTO', 'CFO')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memo types
CREATE TABLE memo_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memo statuses (reference)
CREATE TABLE memo_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0
);

-- Memo numbering sequence (company-wide)
CREATE TABLE memo_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INT NOT NULL UNIQUE,
  last_sequence INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branding settings
CREATE TABLE branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT DEFAULT 'OneSource',
  company_short_name TEXT DEFAULT 'OneSource',
  company_address TEXT,
  logo_path TEXT,
  footer_text TEXT,
  confidentiality_notice TEXT DEFAULT 'CONFIDENTIAL - For internal use only. Unauthorized disclosure is prohibited.',
  page_number_style TEXT DEFAULT 'Page {current} of {total}',
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval workflows
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  memo_type_id UUID REFERENCES memo_types(id),
  department_id UUID REFERENCES departments(id),
  is_default BOOLEAN DEFAULT FALSE,
  requires_exco BOOLEAN DEFAULT FALSE,
  requires_finance BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval steps
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES approval_workflows(id) ON DELETE CASCADE NOT NULL,
  step_order INT NOT NULL,
  role_slug TEXT NOT NULL,
  step_name TEXT NOT NULL,
  is_parallel BOOLEAN DEFAULT FALSE,
  sla_hours INT DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, step_order)
);

-- Memos
CREATE TABLE memos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_number TEXT NOT NULL UNIQUE,
  memo_type_id UUID REFERENCES memo_types(id) NOT NULL,
  status_id UUID REFERENCES memo_statuses(id) NOT NULL,
  creator_id UUID REFERENCES users(id) NOT NULL,
  department_id UUID REFERENCES departments(id) NOT NULL,
  workflow_id UUID REFERENCES approval_workflows(id),
  current_version INT DEFAULT 1,
  current_step_order INT DEFAULT 0,

  -- Template fields
  memo_from TEXT,
  memo_thru TEXT,
  memo_to TEXT,
  memo_date DATE DEFAULT CURRENT_DATE,
  subject TEXT,
  background TEXT,
  financial_implication TEXT,
  justification TEXT,
  recommendation TEXT,

  -- Routing flags
  requires_exco BOOLEAN DEFAULT FALSE,
  requires_finance BOOLEAN DEFAULT FALSE,
  importance_level TEXT DEFAULT 'normal' CHECK (importance_level IN ('normal', 'high', 'exco')),

  -- Withdrawal/rejection
  withdrawal_reason TEXT,
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memo versions
CREATE TABLE memo_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  version_number INT NOT NULL,
  memo_from TEXT,
  memo_thru TEXT,
  memo_to TEXT,
  memo_date DATE,
  subject TEXT,
  background TEXT,
  financial_implication TEXT,
  justification TEXT,
  recommendation TEXT,
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(memo_id, version_number)
);

-- Memo attachments
CREATE TABLE memo_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  version_number INT DEFAULT 1,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approvals (individual approval records)
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  step_order INT NOT NULL,
  approver_id UUID REFERENCES users(id) NOT NULL,
  delegated_from_id UUID REFERENCES users(id),
  action TEXT CHECK (action IN ('approve', 'return', 'reject', 'pending')),
  comments TEXT,
  signature_path TEXT,
  signed_at TIMESTAMPTZ,
  is_parallel BOOLEAN DEFAULT FALSE,
  parallel_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EXCO parallel approvals tracking
CREATE TABLE exco_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  exco_member_id UUID REFERENCES exco_members(id) NOT NULL,
  approver_id UUID REFERENCES users(id) NOT NULL,
  action TEXT DEFAULT 'pending' CHECK (action IN ('approve', 'return', 'reject', 'pending')),
  comments TEXT,
  signature_path TEXT,
  signed_at TIMESTAMPTZ,
  delegated_from_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(memo_id, exco_member_id)
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  visible_to_shared_only BOOLEAN DEFAULT FALSE,
  shared_with_user_id UUID REFERENCES users(id),
  approval_id UUID REFERENCES approvals(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signatures (approval signature records)
CREATE TABLE signature_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  approver_id UUID REFERENCES users(id) NOT NULL,
  approver_name TEXT NOT NULL,
  approver_title TEXT,
  signature_path TEXT NOT NULL,
  block_type TEXT CHECK (block_type IN ('prepared', 'checked', 'reviewed', 'approved')),
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  delegated_from_id UUID REFERENCES users(id),
  delegation_note TEXT
);

-- Delegations
CREATE TABLE delegations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_approver_id UUID REFERENCES users(id) NOT NULL,
  delegated_to_id UUID REFERENCES users(id) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared memo access
CREATE TABLE shared_memo_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  shared_by UUID REFERENCES users(id) NOT NULL,
  shared_with UUID REFERENCES users(id) NOT NULL,
  can_comment BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(memo_id, shared_with)
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  memo_id UUID REFERENCES memos(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA settings
CREATE TABLE sla_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_slug TEXT NOT NULL UNIQUE,
  sla_hours INT NOT NULL,
  reminder_hours_before INT DEFAULT 4,
  escalation_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA tracking per memo step
CREATE TABLE sla_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  step_order INT NOT NULL,
  assigned_to UUID REFERENCES users(id),
  due_at TIMESTAMPTZ NOT NULL,
  reminded_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  breached_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'breached', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trash records
CREATE TABLE trash_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL UNIQUE,
  deleted_by UUID REFERENCES users(id) NOT NULL,
  delete_reason TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  restored_at TIMESTAMPTZ,
  restored_by UUID REFERENCES users(id),
  permanently_deleted_at TIMESTAMPTZ,
  permanently_deleted_by UUID REFERENCES users(id)
);

-- Notification settings
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL UNIQUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_memos_creator ON memos(creator_id);
CREATE INDEX idx_memos_department ON memos(department_id);
CREATE INDEX idx_memos_status ON memos(status_id);
CREATE INDEX idx_memos_reference ON memos(reference_number);
CREATE INDEX idx_approvals_memo ON approvals(memo_id);
CREATE INDEX idx_audit_logs_memo ON audit_logs(memo_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_sla_tracking_memo ON sla_tracking(memo_id);

-- Function: generate memo reference number
CREATE OR REPLACE FUNCTION generate_memo_reference()
RETURNS TEXT AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM NOW())::INT;
  next_seq INT;
  ref_number TEXT;
BEGIN
  INSERT INTO memo_sequences (year, last_sequence)
  VALUES (current_year, 1)
  ON CONFLICT (year) DO UPDATE
  SET last_sequence = memo_sequences.last_sequence + 1,
      updated_at = NOW()
  RETURNING last_sequence INTO next_seq;

  IF next_seq IS NULL THEN
    SELECT last_sequence INTO next_seq FROM memo_sequences WHERE year = current_year;
  END IF;

  ref_number := 'RPS/EMEMO/' || current_year || '/' || LPAD(next_seq::TEXT, 4, '0');
  RETURN ref_number;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER memos_updated_at BEFORE UPDATE ON memos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies (basic - enable RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
