-- RLS policy adjustments to avoid recursion
-- Date: 2025-09-25

-- NOTE: Apply this in Supabase SQL editor or via CLI.

-- =====================
-- projects (no change)
-- Keep existing policies on projects; ensure they don't depend on project_members policies.
-- =====================

-- =====================
-- project_members
-- Replace SELECT policy that referenced projects (causing recursion)
-- New policy allows viewing members if the current user is a member of the same project
-- or the row is the current user's own membership record.
-- =====================

DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;

CREATE POLICY "Members can view project members"
ON public.project_members
FOR SELECT
USING (
  -- allow viewing own membership row
  user_id = auth.uid()
  OR
  -- allow viewing members of projects the user belongs to
  EXISTS (
    SELECT 1 FROM public.project_members pm2
    WHERE pm2.project_id = project_members.project_id
      AND pm2.user_id = auth.uid()
  )
);

-- Keep the manage members policy but ensure it does not reference projects
DROP POLICY IF EXISTS "Project owners and admins can manage members" ON public.project_members;

CREATE POLICY "Admins can manage members"
ON public.project_members
FOR ALL
USING (
  -- allow actions if the user is admin member of the project
  EXISTS (
    SELECT 1 FROM public.project_members pm2
    WHERE pm2.project_id = project_members.project_id
      AND pm2.user_id = auth.uid()
      AND pm2.role = 'admin'
  )
);

-- =====================
-- references
-- Replace policies that referenced projects table (causing recursion)
-- New policies rely only on saved_by and project_members.
-- =====================

DROP POLICY IF EXISTS "Users can view references in their projects" ON public.references;
DROP POLICY IF EXISTS "Users can insert references to their projects" ON public.references;
DROP POLICY IF EXISTS "Users can update own references or project references with permission" ON public.references;
DROP POLICY IF EXISTS "Users can delete own references or project references with permission" ON public.references;

-- SELECT: allow if saved_by is self or user is member of the project
CREATE POLICY "View own or project references"
ON public.references
FOR SELECT
USING (
  saved_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
  )
);

-- INSERT: allow if saved_by is self and user is member (or owner inserts to own project)
CREATE POLICY "Insert project references"
ON public.references
FOR INSERT
WITH CHECK (
  saved_by = auth.uid()
  AND (
    project_id IS NULL -- allow personal references without project
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_id
        AND pm.user_id = auth.uid()
    )
  )
);

-- UPDATE: allow if user created the reference or is editor/admin member
CREATE POLICY "Update project references"
ON public.references
FOR UPDATE
USING (
  saved_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('editor','admin')
  )
);

-- DELETE: allow if user created the reference or is admin member
CREATE POLICY "Delete project references"
ON public.references
FOR DELETE
USING (
  saved_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'admin'
  )
);

-- =====================
-- Optional: ensure owner is inserted as admin member on project creation to support policies
-- (Run once; or enforce at application layer.)
-- CREATE OR REPLACE FUNCTION public.ensure_owner_membership() ...
-- Skipped here for safety.
