-- Ensure IT Request workflow is Emma → Jim → Christine → CEO (migration 011 must not drop Jim).

DO $$
DECLARE wf_id UUID; mt_id UUID;
BEGIN
  SELECT id INTO mt_id FROM memo_types WHERE slug = 'it_request' LIMIT 1;
  IF mt_id IS NULL THEN RETURN; END IF;
  SELECT id INTO wf_id FROM approval_workflows WHERE memo_type_id = mt_id AND is_default = TRUE LIMIT 1;
  IF wf_id IS NULL THEN RETURN; END IF;

  UPDATE approval_workflows SET requires_finance = TRUE WHERE id = wf_id;

  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours) VALUES
    (wf_id, 1, 'it_checker_first', 'IT Check — 1st (Emma)', 24),
    (wf_id, 2, 'it_checker_second', 'IT Check — 2nd (Jim)', 24),
    (wf_id, 3, 'finance_reviewer', 'Finance Review (Christine)', 48),
    (wf_id, 4, 'ceo', 'CEO Approval', 72);
END $$;

-- Memos that jumped to Christine before Jim (wrong step_order / status sync)
UPDATE memos m
SET
  status_id = (SELECT id FROM memo_statuses WHERE slug = 'pending_it_checker_second' LIMIT 1),
  current_step_order = 2,
  updated_at = NOW()
WHERE m.memo_type_id = (SELECT id FROM memo_types WHERE slug = 'it_request' LIMIT 1)
  AND m.status_id = (SELECT id FROM memo_statuses WHERE slug = 'pending_finance' LIMIT 1)
  AND m.current_step_order >= 3
  AND (
    SELECT COUNT(*)::int
    FROM signature_records sr
    WHERE sr.memo_id = m.id AND sr.block_type = 'checked'
  ) = 1;
