-- 017_sharing_system.sql
-- プロジェクト共有システム マイグレーション
-- 作成日: 2025-12-02
-- 修正: RLSポリシーの無限再帰を解消

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
DROP INDEX IF EXISTS idx_project_invitations_unique_pending;
CREATE UNIQUE INDEX idx_project_invitations_unique_pending 
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
-- 3. project_invitations テーブルのRLSポリシー
-- =====================================================

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Inviters can view their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Invitees can view their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Project owners and editors can create invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Inviters can update their invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Invitees can respond to invitations" ON public.project_invitations;
DROP POLICY IF EXISTS "Inviters can delete their invitations" ON public.project_invitations;

-- シンプルなポリシー: 招待者または被招待者のみアクセス可能
CREATE POLICY "Users can view related invitations"
  ON public.project_invitations
  FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- 認証済みユーザーは招待を作成可能（詳細なチェックはアプリケーション側で実施）
CREATE POLICY "Authenticated users can create invitations"
  ON public.project_invitations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND inviter_id = auth.uid());

-- 招待者または被招待者は更新可能
CREATE POLICY "Related users can update invitations"
  ON public.project_invitations
  FOR UPDATE
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- 招待者は削除可能
CREATE POLICY "Inviters can delete invitations"
  ON public.project_invitations
  FOR DELETE
  USING (inviter_id = auth.uid());

-- =====================================================
-- 4. 共有トークン再生成用の関数
-- =====================================================

CREATE OR REPLACE FUNCTION regenerate_link_sharing_token(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token uuid;
  project_owner_id uuid;
BEGIN
  -- プロジェクトオーナーを取得
  SELECT owner_id INTO project_owner_id
  FROM public.projects
  WHERE id = p_project_id;

  -- オーナーのみが実行可能
  IF project_owner_id IS NULL OR project_owner_id != auth.uid() THEN
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
-- 注意: 既存のRLSポリシーは変更しません
-- リンク共有のアクセス制御はアプリケーション側で実装します
-- これにより、循環参照の問題を回避します
-- =====================================================
