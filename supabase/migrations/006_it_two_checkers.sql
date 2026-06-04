-- IT requests: Emma (1st checker) then Jim (2nd checker) after department head.

INSERT INTO roles (name, slug, description)
VALUES
  ('IT Checker (1st)', 'it_checker_first', 'First IT review — Emma'),
  ('IT Checker (2nd)', 'it_checker_second', 'Second IT review — Jim')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO memo_statuses (name, slug, sort_order)
VALUES
  ('Pending IT Check (1st)', 'pending_it_checker_first', 4),
  ('Pending IT Check (2nd)', 'pending_it_checker_second', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sla_settings (role_slug, sla_hours, reminder_hours_before)
VALUES
  ('it_checker_first', 24, 4),
  ('it_checker_second', 24, 4)
ON CONFLICT (role_slug) DO NOTHING;

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

  DELETE FROM approval_steps WHERE workflow_id = wf_id;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES
    (wf_id, 1, 'department_head', 'IT Department Head Approval', 24),
    (wf_id, 2, 'it_checker_first', 'IT Check — 1st (Emma)', 24),
    (wf_id, 3, 'it_checker_second', 'IT Check — 2nd (Jim)', 24),
    (wf_id, 4, 'ceo', 'CEO Approval', 72);
END $$;
