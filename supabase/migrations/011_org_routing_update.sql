-- Org routing: Dorothy HR head, Amara CFO all finance steps, Norman marketing/business, Emmanuel OPS

-- HR Request: Amara (CFO) → CEO
DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'hr_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;
  DELETE FROM approval_steps WHERE workflow_id = wf_id;
  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours) VALUES
    (wf_id, 1, 'finance_reviewer', 'CFO Review (Amara)', 48),
    (wf_id, 2, 'ceo', 'CEO Approval', 72);
END $$;

-- Marketing: Norman (business) → Amara → CEO
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
    (wf_id, 2, 'finance_reviewer', 'CFO Review (Amara)', 48),
    (wf_id, 3, 'ceo', 'CEO Approval', 72);
END $$;

-- IT Request: finance step → Amara
DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'it_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;
  UPDATE approval_steps SET step_name = 'CFO Review (Amara)', role_slug = 'finance_reviewer'
  WHERE workflow_id = wf_id AND step_order = 3;
END $$;
