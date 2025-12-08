-- =====================================================
-- 緊急修正: RLSポリシーの無限再帰エラーを解消
-- 
-- このSQLをSupabaseダッシュボード > SQL Editor で実行してください
-- =====================================================

-- トランザクション開始
BEGIN;

-- =====================================================
-- 1. 問題のあるポリシーをすべて削除
-- =====================================================

-- projects テーブル
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they own or are members of" ON public.projects;

-- references テーブル
DROP POLICY IF EXISTS "Users can view references in accessible projects" ON public.references;
DROP POLICY IF EXISTS "Users can view references in their projects" ON public.references;

-- selected_texts テーブル
DROP POLICY IF EXISTS "Users can view selected texts in accessible projects" ON public.selected_texts;
DROP POLICY IF EXISTS "Users can view selected texts in their projects" ON public.selected_texts;

-- bookmarks テーブル
DROP POLICY IF EXISTS "Users can view bookmarks in accessible projects" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can view bookmarks in their projects" ON public.bookmarks;

-- project_members テーブル
DROP POLICY IF EXISTS "Users can view project members for accessible projects" ON public.project_members;
DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;

-- profiles テーブル
DROP POLICY IF EXISTS "Users can view profiles for invitations" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- project_invitations テーブル（もし存在すれば）
DROP POLICY IF EXISTS "Inviters can view their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Invitees can view their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Project owners and editors can create invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Inviters can update their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Invitees can respond to invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Inviters can delete their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Users can view related invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Authenticated users can create invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Related users can update invitations" ON public.project_invitations;

-- =====================================================
-- 2. シンプルで循環参照のないポリシーを再作成
-- =====================================================

-- profiles テーブル: 認証済みユーザーは全プロファイルを閲覧可能
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- projects テーブル: オーナーまたはメンバーのみ閲覧可能
CREATE POLICY "Users can view own or member projects" 
  ON public.projects
  FOR SELECT 
  USING (
    owner_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id 
      AND pm.user_id = auth.uid()
    )
  );

-- project_members テーブル: プロジェクトオーナーまたは自分自身のメンバーシップ
CREATE POLICY "Users can view project members" 
  ON public.project_members
  FOR SELECT 
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id 
      AND p.owner_id = auth.uid()
    )
  );

-- references テーブル
CREATE POLICY "Users can view references" 
  ON public.references
  FOR SELECT 
  USING (
    saved_by = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = references.project_id 
      AND p.owner_id = auth.uid()
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = references.project_id 
      AND pm.user_id = auth.uid()
    )
  );

-- selected_texts テーブル
CREATE POLICY "Users can view selected texts"
  ON public.selected_texts
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = selected_texts.project_id 
      AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = selected_texts.project_id 
      AND pm.user_id = auth.uid()
    )
  );

-- bookmarks テーブル
CREATE POLICY "Users can view bookmarks"
  ON public.bookmarks
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = bookmarks.project_id 
      AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = bookmarks.project_id 
      AND pm.user_id = auth.uid()
    )
  );

-- =====================================================
-- 3. project_invitations テーブルのポリシー（テーブルが存在する場合）
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_invitations') THEN
    -- RLSを有効化
    ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
    
    -- シンプルなポリシーを作成
    CREATE POLICY "Users can view related invitations"
      ON public.project_invitations
      FOR SELECT
      USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

    CREATE POLICY "Authenticated users can create invitations"
      ON public.project_invitations
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND inviter_id = auth.uid());

    CREATE POLICY "Related users can update invitations"
      ON public.project_invitations
      FOR UPDATE
      USING (inviter_id = auth.uid() OR invitee_id = auth.uid())
      WITH CHECK (inviter_id = auth.uid() OR invitee_id = auth.uid());

    CREATE POLICY "Inviters can delete invitations"
      ON public.project_invitations
      FOR DELETE
      USING (inviter_id = auth.uid());
  END IF;
END $$;

-- コミット
COMMIT;

-- 確認メッセージ
SELECT 'RLSポリシーの修正が完了しました' as message;

