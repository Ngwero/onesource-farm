-- General internal memos: route through Finance after Department Head (Christine Kangume as Finance Reviewer).

UPDATE approval_workflows w
SET requires_finance = TRUE
FROM memo_types mt
WHERE w.memo_type_id = mt.id
  AND mt.slug = 'general_internal'
  AND w.is_default = TRUE;

DO $$
DECLARE
  wf_id UUID;
BEGIN
  SELECT w.id INTO wf_id
  FROM approval_workflows w
  JOIN memo_types mt ON w.memo_type_id = mt.id
  WHERE mt.slug = 'general_internal'
    AND w.is_default = TRUE
  LIMIT 1;

  IF wf_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM approval_steps
    WHERE workflow_id = wf_id AND role_slug = 'finance_reviewer'
  ) THEN
    RETURN;
  END IF;

  UPDATE approval_steps
  SET step_order = step_order + 1
  WHERE workflow_id = wf_id AND step_order >= 2;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES (wf_id, 2, 'finance_reviewer', 'Finance Review', 48);
END $$;
