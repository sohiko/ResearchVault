-- 018_fix_rls_recursion.sql
-- RLSポリシーの無限再帰エラーを修正
-- 作成日: 2025-12-02

-- =====================================================
-- 問題のあるポリシーを削除
-- =====================================================

-- projects テーブルの問題ポリシーを削除
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;

-- references テーブルの問題ポリシーを削除
DROP POLICY IF EXISTS "Users can view references in accessible projects" ON public.references;

-- selected_texts テーブルの問題ポリシーを削除
DROP POLICY IF EXISTS "Users can view selected texts in accessible projects" ON public.selected_texts;

-- bookmarks テーブルの問題ポリシーを削除
DROP POLICY IF EXISTS "Users can view bookmarks in accessible projects" ON public.bookmarks;

-- project_members テーブルの問題ポリシーを削除
DROP POLICY IF EXISTS "Users can view project members for accessible projects" ON public.project_members;

-- profiles テーブルの問題ポリシーを削除
DROP POLICY IF EXISTS "Users can view profiles for invitations" ON public.profiles;

-- =====================================================
-- 元のシンプルなポリシーを復元
-- =====================================================

-- projects テーブル: オーナーまたはメンバーのみ閲覧可能
-- （リンク共有はアプリケーション側で制御）
CREATE POLICY "Users can view projects they own or are members of" 
  ON public.projects
  FOR SELECT 
  USING (
    owner_id = auth.uid() 
    OR 
    id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

-- references テーブル
CREATE POLICY "Users can view references in their projects" 
  ON public.references
  FOR SELECT 
  USING (
    saved_by = auth.uid()
    OR 
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    ) 
    OR 
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

-- project_members テーブル
CREATE POLICY "Users can view project members for their projects" 
  ON public.project_members
  FOR SELECT 
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    ) 
    OR 
    user_id = auth.uid()
  );

-- profiles テーブル: 認証済みユーザーは他のプロファイルを検索可能（招待用）
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 追加の修正: selected_texts と bookmarks のポリシー確認
-- =====================================================

-- selected_texts の既存ポリシーを確認・再作成
DROP POLICY IF EXISTS "Users can manage own selected texts" ON public.selected_texts;

CREATE POLICY "Users can manage own selected texts" 
  ON public.selected_texts
  FOR ALL 
  USING (created_by = auth.uid());

-- 閲覧用の追加ポリシー（プロジェクトメンバーも閲覧可能）
CREATE POLICY "Users can view selected texts in their projects"
  ON public.selected_texts
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
    )
  );

-- bookmarks の既存ポリシーを確認・再作成
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.bookmarks;

CREATE POLICY "Users can manage own bookmarks" 
  ON public.bookmarks
  FOR ALL 
  USING (created_by = auth.uid());

-- 閲覧用の追加ポリシー（プロジェクトメンバーも閲覧可能）
CREATE POLICY "Users can view bookmarks in their projects"
  ON public.bookmarks
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    project_id IN (
      SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
    )
  );

