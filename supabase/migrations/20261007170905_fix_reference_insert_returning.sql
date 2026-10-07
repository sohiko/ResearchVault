-- INSERT ... RETURNING must authorize the proposed row, not re-read it through
-- a STABLE helper whose statement snapshot cannot see the newly inserted row.
-- Preserve the existing private/project/trash access rules exactly.
ALTER POLICY references_read ON public."references" TO authenticated
USING (
  ((project_id IS NULL AND saved_by = (SELECT auth.uid()))
    OR (project_id IS NOT NULL AND private.project_access(project_id, 'read')))
  AND (deleted_at IS NULL OR saved_by = (SELECT auth.uid())
    OR private.project_access(project_id, 'manage'))
);
