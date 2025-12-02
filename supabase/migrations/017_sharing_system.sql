-- 017_sharing_system.sql
-- プロジェクト共有システム マイグレーション
-- 作成日: 2025-12-02

-- =====================================================
-- 1. projectsテーブルにリンク共有用カラムを追加
-- =====================================================

-- is_link_sharing_enabled: リンク共有の有効/無効を制御
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'projects' 
    AND column_name = 'is_link_sharing_enabled'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN is_link_sharing_enabled boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- link_sharing_token: 共有リンク用のセキュリティトークン
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'projects' 
    AND column_name = 'link_sharing_token'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN link_sharing_token uuid DEFAULT uuid_generate_v4();
  END IF;
END $$;

-- コメント追加
COMMENT ON COLUMN public.projects.is_link_sharing_enabled IS 'リンク共有が有効かどうか（trueの場合、トークンを持つ人は閲覧可能）';
COMMENT ON COLUMN public.projects.link_sharing_token IS '共有リンク用のセキュリティトークン';

-- =====================================================
-- 2. project_invitationsテーブルの作成
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  invitee_email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  message text,
  email_sent_at timestamp with time zone,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT project_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT project_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT project_invitations_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ユニーク制約: 同じプロジェクトに同じユーザーへの未処理招待は1つまで
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_invitations_unique_pending 
ON public.project_invitations (project_id, invitee_id) 
WHERE status = 'pending';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_invitee_id ON public.project_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_created_at ON public.project_invitations(created_at DESC);

-- updated_at自動更新トリガー
DROP TRIGGER IF EXISTS update_project_invitations_updated_at ON public.project_invitations;
CREATE TRIGGER update_project_invitations_updated_at
  BEFORE UPDATE ON public.project_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE public.project_invitations IS 'プロジェクト招待の管理テーブル';
COMMENT ON COLUMN public.project_invitations.status IS '招待のステータス（pending: 保留中, accepted: 承認済み, rejected: 拒否, cancelled: キャンセル）';
COMMENT ON COLUMN public.project_invitations.role IS '招待時に付与される権限（viewer: 閲覧者, editor: 編集者）';

-- =====================================================
-- 3. RLSポリシーの設定
-- =====================================================

-- project_invitations テーブルのRLS有効化
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- 招待者は自分が作成した招待を閲覧可能
CREATE POLICY "Inviters can view their invitations"
  ON public.project_invitations
  FOR SELECT
  USING (inviter_id = auth.uid());

-- 被招待者は自分宛ての招待を閲覧可能
CREATE POLICY "Invitees can view their invitations"
  ON public.project_invitations
  FOR SELECT
  USING (invitee_id = auth.uid());

-- プロジェクトオーナーと編集者は招待を作成可能
CREATE POLICY "Project owners and editors can create invitations"
  ON public.project_invitations
  FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid() AND
    (
      -- プロジェクトオーナーである
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE id = project_id AND owner_id = auth.uid()
      )
      OR
      -- 編集者権限を持つメンバーである
      EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = project_invitations.project_id 
        AND user_id = auth.uid() 
        AND role IN ('editor', 'admin')
      )
    )
  );

-- 招待者は招待をキャンセル可能
CREATE POLICY "Inviters can update their invitations"
  ON public.project_invitations
  FOR UPDATE
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

-- 被招待者は招待に応答可能（ステータス変更）
CREATE POLICY "Invitees can respond to invitations"
  ON public.project_invitations
  FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid());

-- 招待者は招待を削除可能
CREATE POLICY "Inviters can delete their invitations"
  ON public.project_invitations
  FOR DELETE
  USING (inviter_id = auth.uid());

-- =====================================================
-- 4. projectsテーブルのRLSポリシー更新（リンク共有対応）
-- =====================================================

-- 既存のSELECTポリシーを削除して再作成
DROP POLICY IF EXISTS "Users can view projects they own or are members of" ON public.projects;

-- 新しいSELECTポリシー: オーナー、メンバー、またはリンク共有が有効な場合
CREATE POLICY "Users can view accessible projects"
  ON public.projects
  FOR SELECT
  USING (
    -- オーナーである
    owner_id = auth.uid()
    OR
    -- メンバーである
    id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
    OR
    -- リンク共有が有効で、認証済みユーザーである
    (is_link_sharing_enabled = true AND auth.uid() IS NOT NULL)
  );

-- =====================================================
-- 5. referencesテーブルのRLSポリシー更新（リンク共有対応）
-- =====================================================

-- 既存のSELECTポリシーを削除して再作成
DROP POLICY IF EXISTS "Users can view references in their projects" ON public.references;

-- 新しいSELECTポリシー
CREATE POLICY "Users can view references in accessible projects"
  ON public.references
  FOR SELECT
  USING (
    -- 自分が保存した参照
    saved_by = auth.uid()
    OR
    -- プロジェクトオーナーの参照
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    -- メンバーとしてアクセス可能なプロジェクトの参照
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
    OR
    -- リンク共有が有効なプロジェクトの参照
    project_id IN (
      SELECT id FROM public.projects 
      WHERE is_link_sharing_enabled = true AND auth.uid() IS NOT NULL
    )
  );

-- =====================================================
-- 6. selected_textsテーブルのRLSポリシー更新（リンク共有対応）
-- =====================================================

-- 閲覧用のポリシーを追加（リンク共有対応）
DROP POLICY IF EXISTS "Users can view selected texts in accessible projects" ON public.selected_texts;

CREATE POLICY "Users can view selected texts in accessible projects"
  ON public.selected_texts
  FOR SELECT
  USING (
    -- 自分が作成したテキスト
    created_by = auth.uid()
    OR
    -- プロジェクトオーナーのテキスト
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    -- メンバーとしてアクセス可能なプロジェクトのテキスト
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
    OR
    -- リンク共有が有効なプロジェクトのテキスト
    project_id IN (
      SELECT id FROM public.projects 
      WHERE is_link_sharing_enabled = true AND auth.uid() IS NOT NULL
    )
  );

-- =====================================================
-- 7. bookmarksテーブルのRLSポリシー更新（リンク共有対応）
-- =====================================================

-- 閲覧用のポリシーを追加（リンク共有対応）
DROP POLICY IF EXISTS "Users can view bookmarks in accessible projects" ON public.bookmarks;

CREATE POLICY "Users can view bookmarks in accessible projects"
  ON public.bookmarks
  FOR SELECT
  USING (
    -- 自分が作成したブックマーク
    created_by = auth.uid()
    OR
    -- プロジェクトオーナーのブックマーク
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    -- メンバーとしてアクセス可能なプロジェクトのブックマーク
    project_id IN (
      SELECT project_id FROM public.project_members 
      WHERE user_id = auth.uid()
    )
    OR
    -- リンク共有が有効なプロジェクトのブックマーク
    project_id IN (
      SELECT id FROM public.projects 
      WHERE is_link_sharing_enabled = true AND auth.uid() IS NOT NULL
    )
  );

-- =====================================================
-- 8. project_membersテーブルのRLSポリシー更新
-- =====================================================

-- リンク共有でプロジェクトを閲覧している人もメンバー一覧を見れるようにする
DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;

CREATE POLICY "Users can view project members for accessible projects"
  ON public.project_members
  FOR SELECT
  USING (
    -- プロジェクトオーナーである
    project_id IN (
      SELECT id FROM public.projects WHERE owner_id = auth.uid()
    )
    OR
    -- 自分がメンバーである
    user_id = auth.uid()
    OR
    -- リンク共有が有効なプロジェクト
    project_id IN (
      SELECT id FROM public.projects 
      WHERE is_link_sharing_enabled = true AND auth.uid() IS NOT NULL
    )
  );

-- =====================================================
-- 9. 共有トークン再生成用の関数
-- =====================================================

CREATE OR REPLACE FUNCTION regenerate_link_sharing_token(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token uuid;
BEGIN
  -- オーナーのみが実行可能
  IF NOT EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = p_project_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only project owner can regenerate sharing token';
  END IF;

  new_token := uuid_generate_v4();
  
  UPDATE public.projects 
  SET link_sharing_token = new_token, 
      updated_at = timezone('utc'::text, now())
  WHERE id = p_project_id;
  
  RETURN new_token;
END;
$$;

-- =====================================================
-- 10. profilesテーブルの閲覧ポリシー更新
-- =====================================================

-- 招待のために他のユーザーのプロファイル（メールアドレス）を検索できるようにする
DROP POLICY IF EXISTS "Users can view profiles for invitations" ON public.profiles;

CREATE POLICY "Users can view profiles for invitations"
  ON public.profiles
  FOR SELECT
  USING (
    -- 自分のプロファイル
    id = auth.uid()
    OR
    -- 同じプロジェクトのメンバー
    id IN (
      SELECT pm.user_id FROM public.project_members pm
      WHERE pm.project_id IN (
        SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.projects WHERE owner_id = auth.uid()
      )
    )
    OR
    -- プロジェクトオーナー
    id IN (
      SELECT p.owner_id FROM public.projects p
      WHERE p.id IN (
        SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
      )
    )
    -- 認証済みユーザーはメールで他ユーザーを検索可能（招待用）
    OR auth.uid() IS NOT NULL
  );

