-- IT requests: second review step (Jim Ntare as IT Reviewer) after Department Head.

INSERT INTO roles (name, slug, description)
VALUES ('IT Reviewer', 'it_reviewer', 'Second-line IT review for IT requests')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO memo_statuses (name, slug, sort_order)
VALUES ('Pending IT Review', 'pending_it_review', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sla_settings (role_slug, sla_hours, reminder_hours_before)
VALUES ('it_reviewer', 24, 4)
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

  IF EXISTS (
    SELECT 1 FROM approval_steps
    WHERE workflow_id = wf_id AND role_slug = 'it_reviewer'
  ) THEN
    RETURN;
  END IF;

  UPDATE approval_steps
  SET step_order = step_order + 1
  WHERE workflow_id = wf_id AND step_order >= 2;

  INSERT INTO approval_steps (workflow_id, step_order, role_slug, step_name, sla_hours)
  VALUES (wf_id, 2, 'it_reviewer', 'IT Second Review', 24);
END $$;
