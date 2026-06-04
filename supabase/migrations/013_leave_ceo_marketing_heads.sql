-- Leave: dept head → CEO. Marketing dept head = Margaret; business head = Norman.

DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'leave_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;
  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours) VALUES
    (wf_id, 1, 'department_head', 'Department Head Approval', 24),
    (wf_id, 2, 'ceo', 'CEO Approval', 72);
END $$;
