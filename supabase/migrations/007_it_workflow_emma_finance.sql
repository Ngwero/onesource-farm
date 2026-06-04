-- IT Request: Emma → Jim → Christine (Finance) → CEO (no department head step)

DO $$
DECLARE
  wf_id UUID;
BEGIN
  SELECT w.id INTO wf_id
  FROM approval_workflows w
  JOIN memo_types mt ON w.memo_type_id = mt.id
  WHERE mt.slug = 'it_request'
    AND w.is_default = TRUE
  LIMIT 1;

  IF wf_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE approval_workflows
  SET requires_finance = TRUE
  WHERE id = wf_id;

  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES
    (wf_id, 1, 'it_checker_first', 'IT Check — 1st (Emma)', 24),
    (wf_id, 2, 'it_checker_second', 'IT Check — 2nd (Jim)', 24),
    (wf_id, 3, 'finance_reviewer', 'Finance Review (Christine)', 48),
    (wf_id, 4, 'ceo', 'CEO Approval', 72);
END $$;

-- Move IT memos stuck on old "department head" step to Emma (1st IT check)
UPDATE memos m
SET
  status_id = (SELECT id FROM memo_statuses WHERE slug = 'pending_it_checker_first' LIMIT 1),
  current_step_order = 1,
  requires_finance = TRUE,
  updated_at = NOW()
WHERE m.memo_type_id = (SELECT id FROM memo_types WHERE slug = 'it_request' LIMIT 1)
  AND m.status_id = (SELECT id FROM memo_statuses WHERE slug = 'pending_department_head' LIMIT 1);
