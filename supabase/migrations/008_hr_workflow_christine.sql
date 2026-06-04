-- HR Request: Christine reviews, then CEO (no department head / hr_reviewer step)

DO $$
DECLARE
  wf_id UUID;
BEGIN
  SELECT w.id INTO wf_id
  FROM approval_workflows w
  JOIN memo_types mt ON w.memo_type_id = mt.id
  WHERE mt.slug = 'hr_request'
    AND w.is_default = TRUE
  LIMIT 1;

  IF wf_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES
    (wf_id, 1, 'finance_reviewer', 'HR Review (Christine)', 48),
    (wf_id, 2, 'ceo', 'CEO Approval', 72);
END $$;

-- Move HR memos stuck on old steps to Christine (pending finance)
UPDATE memos m
SET
  status_id = (SELECT id FROM memo_statuses WHERE slug = 'pending_finance' LIMIT 1),
  current_step_order = 1,
  updated_at = NOW()
WHERE m.memo_type_id = (SELECT id FROM memo_types WHERE slug = 'hr_request' LIMIT 1)
  AND m.status_id IN (
    SELECT id FROM memo_statuses
    WHERE slug IN ('pending_department_head', 'pending_hr')
  );
