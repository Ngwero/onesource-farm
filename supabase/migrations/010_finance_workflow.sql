-- Finance dept memos: Christine creates → Amara reviews → CEO

INSERT INTO memo_types (name, slug, description)
VALUES ('Finance Request', 'finance_request', 'Finance department internal request')
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  wf_id UUID;
  mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'finance_request' LIMIT 1;
  IF mt_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO wf_id FROM approval_workflows
  WHERE memo_type_id = mt_id AND is_default = TRUE
  LIMIT 1;

  IF wf_id IS NULL THEN
    INSERT INTO approval_workflows (name, memo_type_id, is_default, requires_finance)
    VALUES ('Finance Request Workflow', mt_id, TRUE, TRUE)
    RETURNING id INTO wf_id;
  END IF;

  UPDATE approval_workflows SET requires_finance = TRUE WHERE id = wf_id;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES
    (wf_id, 1, 'finance_reviewer', 'Finance Review (Amara)', 48),
    (wf_id, 2, 'ceo', 'CEO Approval', 72);
END $$;
