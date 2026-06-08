-- Live DB: finance reviewer steps may still say Amara / CFO / generic "Finance Review"
-- from migrations 010–011. Standardise on Christine (keep HR-specific label).

UPDATE approval_steps
SET step_name = 'Finance Review (Christine)'
WHERE role_slug = 'finance_reviewer'
  AND step_name NOT IN ('Finance Review (Christine)', 'HR Review (Christine)')
  AND (
    step_name ILIKE '%amara%'
    OR step_name ILIKE 'cfo review%'
    OR step_name = 'Finance Review'
    OR step_name = 'Review (Christine)'
  );
