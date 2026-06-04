-- Amara: finance_request only. Christine: finance step on all other memo types.

DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'hr_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;
  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours) VALUES
    (wf_id, 1, 'finance_reviewer', 'Finance Review (Christine)', 48),
    (wf_id, 2, 'ceo', 'CEO Approval', 72);
END $$;

DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'marketing_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;
  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours) VALUES
    (wf_id, 1, 'business_head', 'Business Head (Norman)', 24),
    (wf_id, 2, 'finance_reviewer', 'Finance Review (Christine)', 48),
    (wf_id, 3, 'ceo', 'CEO Approval', 72);
END $$;

DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'it_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;
  UPDATE approval_steps SET step_name = 'Finance Review (Christine)'
  WHERE workflow_id = wf_id AND role_slug = 'finance_reviewer';
END $$;
