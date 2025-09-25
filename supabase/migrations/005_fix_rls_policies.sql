-- Fix RLS policies to enable project creation and data access
-- Date: 2025-09-25

-- =====================
-- Drop all existing policies to start fresh
-- =====================

-- Drop projects policies
DROP POLICY IF EXISTS "Users can view projects they own or are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects they own" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects they own" ON public.projects;

-- Drop project_members policies
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.project_members;
DROP POLICY IF EXISTS "View own or owner project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners manage members" ON public.project_members;

-- Drop references policies
DROP POLICY IF EXISTS "View own or project references" ON public.references;
DROP POLICY IF EXISTS "Insert project references" ON public.references;
DROP POLICY IF EXISTS "Update project references" ON public.references;
DROP POLICY IF EXISTS "Delete project references" ON public.references;

-- =====================
-- Create new non-recursive policies
-- =====================

-- projects: Simple policies without project_members dependency
CREATE POLICY "Users can view their own projects"
ON public.projects
FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own projects"
ON public.projects
FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
USING (owner_id = auth.uid());

-- project_members: Policies that don't create recursion
CREATE POLICY "Users can view their own memberships"
ON public.project_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Project owners can view all members"
ON public.project_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Project owners can manage members"
ON public.project_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.owner_id = auth.uid()
  )
);

-- references: Policies that work with the new structure
CREATE POLICY "Users can view their own references"
ON public.references
FOR SELECT
USING (saved_by = auth.uid());

CREATE POLICY "Users can view references in their projects"
ON public.references
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = references.project_id
      AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own references"
ON public.references
FOR INSERT
WITH CHECK (
  saved_by = auth.uid()
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = references.project_id
        AND p.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their own references"
ON public.references
FOR UPDATE
USING (saved_by = auth.uid())
WITH CHECK (saved_by = auth.uid());

CREATE POLICY "Users can delete their own references"
ON public.references
FOR DELETE
USING (saved_by = auth.uid());

-- =====================
-- Create function to automatically add owner as admin member
-- =====================

CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the project owner as an admin member
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'admin');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically add owner as member
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project();
