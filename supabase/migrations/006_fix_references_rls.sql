-- Fix references RLS policies to allow null project_id
-- Date: 2025-01-02

-- Drop existing references policies
DROP POLICY IF EXISTS "Users can view their own references" ON public.references;
DROP POLICY IF EXISTS "Users can view references in their projects" ON public.references;
DROP POLICY IF EXISTS "Users can insert their own references" ON public.references;
DROP POLICY IF EXISTS "Users can update their own references" ON public.references;
DROP POLICY IF EXISTS "Users can delete their own references" ON public.references;

-- Create new policies that handle null project_id correctly
CREATE POLICY "Users can view all their references"
ON public.references
FOR SELECT
USING (
  saved_by = auth.uid()
  OR (
    project_id IS NOT NULL
    AND project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert references"
ON public.references
FOR INSERT
WITH CHECK (
  saved_by = auth.uid()
  AND (
    project_id IS NULL  -- Allow null project_id for uncategorized references
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update their references"
ON public.references
FOR UPDATE
USING (saved_by = auth.uid())
WITH CHECK (
  saved_by = auth.uid()
  AND (
    project_id IS NULL  -- Allow null project_id for uncategorized references
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete their references"
ON public.references
FOR DELETE
USING (saved_by = auth.uid());

-- Also fix selected_texts and bookmarks to handle null project_id
DROP POLICY IF EXISTS "Users can manage own selected texts" ON public.selected_texts;
CREATE POLICY "Users can manage selected texts"
ON public.selected_texts
FOR ALL
USING (
  created_by = auth.uid()
  AND (
    project_id IS NULL
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    project_id IS NULL
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can manage bookmarks"
ON public.bookmarks
FOR ALL
USING (
  created_by = auth.uid()
  AND (
    project_id IS NULL
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
)
WITH CHECK (
  created_by = auth.uid()
  AND (
    project_id IS NULL
    OR project_id IN (
      SELECT p.id FROM public.projects p
      WHERE p.owner_id = auth.uid()
    )
  )
);
