-- Marketing: Margaret (MKT head) → Norman (business head) → Christine → CEO

INSERT INTO roles (name, slug, description)
VALUES ('Business Head', 'business_head', 'Head of business / BD sign-off')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO departments (name, code)
VALUES ('Marketing', 'MKT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO memo_types (name, slug, description)
VALUES ('Marketing Request', 'marketing_request', 'Marketing and business development request')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO memo_statuses (name, slug, sort_order)
VALUES ('Pending Business Head', 'pending_business_head', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sla_settings (role_slug, sla_hours, reminder_hours_before)
VALUES ('business_head', 24, 4)
ON CONFLICT (role_slug) DO NOTHING;

DO $$
DECLARE
  wf_id UUID;
  mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'marketing_request' LIMIT 1;
  IF mt_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO wf_id FROM approval_workflows
  WHERE memo_type_id = mt_id AND is_default = TRUE
  LIMIT 1;

  IF wf_id IS NULL THEN
    INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
    VALUES ('Marketing Request Workflow', mt_id, TRUE, TRUE)
    RETURNING id INTO wf_id;
  END IF;

  UPDATE approval_workflows SET requires_finance = TRUE WHERE id = wf_id;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES
    (wf_id, 1, 'department_head', 'Marketing Head (Margaret)', 24),
    (wf_id, 2, 'business_head', 'Business Head (Norman)', 24),
    (wf_id, 3, 'finance_reviewer', 'Review (Christine)', 48),
    (wf_id, 4, 'ceo', 'CEO Approval', 72);
END $$;
