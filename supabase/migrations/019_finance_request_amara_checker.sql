-- Finance Request: Christine creates → Amara (CFO / finance_reviewer) → CEO.
-- Migration 018 relabelled the finance_request step as Christine; restore Amara here only.

DO $$
DECLARE
  wf_id UUID;
  mt_id UUID;
  finance_reviewer_role_id UUID;
  fin_dept_id UUID;
  christine_id UUID;
  pending_finance_id UUID;
  pending_ceo_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'finance_request' LIMIT 1;
  IF mt_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO wf_id FROM approval_workflows
  WHERE memo_type_id = mt_id AND is_default = TRUE
  LIMIT 1;

  IF wf_id IS NULL THEN
    INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance, is_active)
    VALUES ('Finance Request Workflow', mt_id, TRUE, TRUE, TRUE)
    RETURNING id INTO wf_id;
  END IF;

  UPDATE approval_workflows SET requires_finance = TRUE WHERE id = wf_id;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES
    (wf_id, 1, 'finance_reviewer', 'Finance Review (Amara - CFO)', 48),
    (wf_id, 2, 'ceo', 'CEO Approval', 72);

  SELECT id INTO finance_reviewer_role_id FROM roles WHERE slug = 'finance_reviewer' LIMIT 1;
  SELECT id INTO fin_dept_id FROM departments WHERE code = 'FIN' LIMIT 1;

  IF finance_reviewer_role_id IS NOT NULL AND fin_dept_id IS NOT NULL THEN
    UPDATE users
    SET role_id = finance_reviewer_role_id,
        department_id = fin_dept_id,
        title = 'CFO / Finance Reviewer'
    WHERE email ILIKE 'amara.oto@onesourcefresh.com';
  END IF;

  SELECT id INTO christine_id FROM users WHERE email ILIKE 'christine.kangume@onesourcefresh.com' LIMIT 1;
  SELECT id INTO pending_finance_id FROM memo_statuses WHERE slug = 'pending_finance' LIMIT 1;
  SELECT id INTO pending_ceo_id FROM memo_statuses WHERE slug = 'pending_ceo' LIMIT 1;

  IF christine_id IS NOT NULL AND pending_finance_id IS NOT NULL AND pending_ceo_id IS NOT NULL THEN
    UPDATE memos m
    SET status_id = pending_finance_id,
        current_step_order = 1,
        updated_at = NOW()
    WHERE m.memo_type_id = mt_id
      AND m.creator_id = christine_id
      AND m.status_id = pending_ceo_id
      AND NOT EXISTS (
        SELECT 1 FROM approvals a
        WHERE a.memo_id = m.id AND a.action IN ('approve', 'reject', 'return')
      );
  END IF;
END $$;
