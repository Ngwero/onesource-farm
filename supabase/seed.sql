-- Seed data for OneSource e-Memo System

-- Roles
INSERT INTO roles (name, slug, description) VALUES
  ('Admin', 'admin', 'System administrator with full access'),
  ('Staff/User', 'staff', 'Regular staff who create memos'),
  ('Department Head', 'department_head', 'Department head approver'),
  ('Business Head', 'business_head', 'Head of business / BD sign-off'),
  ('IT Checker (1st)', 'it_checker_first', 'First IT review'),
  ('IT Checker (2nd)', 'it_checker_second', 'Second IT review'),
  ('Finance Reviewer', 'finance_reviewer', 'Finance department reviewer'),
  ('HR Reviewer', 'hr_reviewer', 'HR department reviewer'),
  ('CEO / Final Approver', 'ceo', 'Chief Executive Officer'),
  ('EXCO Member', 'exco_member', 'Executive committee member');

-- Departments
INSERT INTO departments (name, code) VALUES
  ('IT', 'IT'),
  ('Finance', 'FIN'),
  ('HR', 'HR'),
  ('CEO Office', 'CEO'),
  ('Business Development', 'BD'),
  ('Marketing', 'MKT'),
  ('Operations', 'OPS');

-- Memo types
INSERT INTO memo_types (name, slug, description) VALUES
  ('Payment Request', 'payment_request', 'Request for payment approval'),
  ('Procurement Request', 'procurement_request', 'Request for procurement approval'),
  ('HR Request', 'hr_request', 'Human resources related request'),
  ('Leave Request', 'leave_request', 'Employee leave request'),
  ('IT Request', 'it_request', 'Information technology request'),
  ('Marketing Request', 'marketing_request', 'Marketing and business development request'),
  ('Finance Request', 'finance_request', 'Finance department internal request'),
  ('General Internal Memo', 'general_internal', 'General internal communication');

-- Memo statuses
INSERT INTO memo_statuses (name, slug, sort_order) VALUES
  ('Draft', 'draft', 1),
  ('Submitted', 'submitted', 2),
  ('Pending Department Head', 'pending_department_head', 3),
  ('Pending Business Head', 'pending_business_head', 4),
  ('Pending IT Review', 'pending_it_review', 5),
  ('Pending IT Check (1st)', 'pending_it_checker_first', 6),
  ('Pending IT Check (2nd)', 'pending_it_checker_second', 7),
  ('Pending Finance', 'pending_finance', 8),
  ('Pending HR', 'pending_hr', 9),
  ('Pending CEO', 'pending_ceo', 10),
  ('Pending EXCO', 'pending_exco', 11),
  ('Returned for Correction', 'returned', 12),
  ('Rejected', 'rejected', 13),
  ('Approved', 'approved', 14),
  ('Withdrawn / Cancelled', 'withdrawn', 15),
  ('Archived', 'archived', 16),
  ('Deleted / Trash', 'deleted', 17);

-- SLA settings
INSERT INTO sla_settings (role_slug, sla_hours, reminder_hours_before) VALUES
  ('department_head', 24, 4),
  ('business_head', 24, 4),
  ('it_checker_first', 24, 4),
  ('it_checker_second', 24, 4),
  ('finance_reviewer', 48, 8),
  ('hr_reviewer', 48, 8),
  ('ceo', 72, 12),
  ('exco_member', 72, 12);

-- Default branding
INSERT INTO branding_settings (
  company_name,
  company_short_name,
  company_address,
  footer_text,
  confidentiality_notice,
  page_number_style
) VALUES (
  'OneSource',
  'OneSource',
  'P.O BOX 111498, 2nd Floor, TMT Building' || E'\n' ||
  'Bukoto-Ntinda Road, Kampala' || E'\n' ||
  'Tel: +256 (0) 200 244 400' || E'\n' ||
  'Email: info@rukapay.co.ug',
  'OneSource',
  'CONFIDENTIAL - This document is intended for internal use only. Unauthorized disclosure, copying, or distribution is strictly prohibited.',
  'Page {current} of {total}'
);

-- Default approval workflows
INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
SELECT 'Payment Request Workflow', id, TRUE, TRUE FROM memo_types WHERE slug = 'payment_request';

INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
SELECT 'Procurement Request Workflow', id, TRUE, TRUE FROM memo_types WHERE slug = 'procurement_request';

INSERT INTO approval_workflows (name, memo_type_id, is_default)
SELECT 'HR Request Workflow', id, TRUE FROM memo_types WHERE slug = 'hr_request';

INSERT INTO approval_workflows (name, memo_type_id, is_default)
SELECT 'Leave Request Workflow', id, TRUE FROM memo_types WHERE slug = 'leave_request';

INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
SELECT 'IT Request Workflow', id, TRUE, FALSE FROM memo_types WHERE slug = 'it_request';

INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance, requires_exco)
SELECT 'General Internal Memo Workflow', id, TRUE, TRUE, FALSE FROM memo_types WHERE slug = 'general_internal';

INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
SELECT 'Marketing Request Workflow', id, TRUE, TRUE FROM memo_types WHERE slug = 'marketing_request';

INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
SELECT 'Finance Request Workflow', id, TRUE, TRUE FROM memo_types WHERE slug = 'finance_request';

-- Workflow steps for Payment Request: Staff → Dept Head → Finance → CEO
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'department_head', 'Department Head Approval', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'payment_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'finance_reviewer', 'Finance Review (Christine)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'payment_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 3, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'payment_request';

-- Procurement (same as payment)
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'department_head', 'Department Head Approval', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'procurement_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'finance_reviewer', 'Finance Review (Christine)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'procurement_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 3, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'procurement_request';

-- HR Request: Christine (finance) → CEO
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'finance_reviewer', 'Finance Review (Christine)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'hr_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'hr_request';

-- Leave Request: Staff → Dept Head → HR
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'department_head', 'Department Head Approval', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'leave_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'leave_request';

-- IT Request: Emma (1st) → Jim (2nd) → Christine (Finance) → CEO
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'it_checker_first', 'IT Check — 1st (Emma)', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'it_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'it_checker_second', 'IT Check — 2nd (Jim)', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'it_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 3, 'finance_reviewer', 'Finance Review (Christine)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'it_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 4, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'it_request';

-- General Internal: Staff → Dept Head → Finance → CEO or EXCO
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'department_head', 'Department Head Approval', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'general_internal';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'finance_reviewer', 'Finance Review (Christine)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'general_internal';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 3, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'general_internal';

-- Marketing (under Business): Norman → Christine → CEO
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'business_head', 'Business Head (Norman)', 24
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'marketing_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'finance_reviewer', 'Finance Review (Christine)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'marketing_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 3, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'marketing_request';

-- Finance Request: Christine creates → Amara (CFO) → CEO
INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 1, 'finance_reviewer', 'Finance Review (Amara - CFO)', 48
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'finance_request';

INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
SELECT w.id, 2, 'ceo', 'CEO Approval', 72
FROM approval_workflows w JOIN memo_types mt ON w.memo_type_id = mt.id WHERE mt.slug = 'finance_request';

-- Notification settings
INSERT INTO notification_settings (event_type, email_enabled, in_app_enabled) VALUES
  ('memo_created', TRUE, TRUE),
  ('memo_submitted', TRUE, TRUE),
  ('memo_routed', TRUE, TRUE),
  ('memo_approved', TRUE, TRUE),
  ('memo_returned', TRUE, TRUE),
  ('memo_rejected', TRUE, TRUE),
  ('memo_resubmitted', TRUE, TRUE),
  ('memo_fully_approved', TRUE, TRUE),
  ('memo_trail_fully_approved', TRUE, TRUE),
  ('memo_withdrawn', TRUE, TRUE),
  ('sla_reminder', TRUE, TRUE),
  ('sla_breached', TRUE, TRUE),
  ('memo_shared', TRUE, TRUE);
