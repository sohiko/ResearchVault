-- 014_comprehensive_fixes.sql
-- ResearchVault 総合修正マイグレーション
-- 作成日: 2025-10-17

-- =====================================================
-- 1. feature_requests テーブルの作成
-- =====================================================
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title character varying(200) NOT NULL,
  description text NOT NULL,
  type character varying(50) DEFAULT 'feature' CHECK (type IN ('feature', 'bug', 'improvement')),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  CONSTRAINT feature_requests_pkey PRIMARY KEY (id),
  CONSTRAINT feature_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- feature_requests用のインデックス
CREATE INDEX IF NOT EXISTS idx_feature_requests_user_id ON public.feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON public.feature_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_type ON public.feature_requests(type);
CREATE INDEX IF NOT EXISTS idx_feature_requests_deleted_at ON public.feature_requests(deleted_at) WHERE deleted_at IS NULL;

-- feature_requests用のRLSポリシー
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の機能リクエストを閲覧可能
CREATE POLICY "Users can view their own feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- 管理者は全ての機能リクエストを閲覧可能
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ユーザーは自分の機能リクエストを作成可能
CREATE POLICY "Users can create their own feature requests"
  ON public.feature_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の機能リクエストを更新可能
CREATE POLICY "Users can update their own feature requests"
  ON public.feature_requests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の機能リクエストを削除可能（ソフト削除）
CREATE POLICY "Users can delete their own feature requests"
  ON public.feature_requests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 2. profiles テーブルに is_admin カラムを追加
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN is_admin boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- is_admin用のインデックス
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = true;

-- =====================================================
-- 3. projects テーブルの検証と修正
-- =====================================================
-- is_public カラムが存在しない場合は追加（将来の機能用）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'projects' 
    AND column_name = 'is_public'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN is_public boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 4. project_members テーブルの検証
-- =====================================================
-- 主キーが正しく設定されているか確認（既に設定済みのはず）
-- 複合主キー: (project_id, user_id)

-- メンバー重複を防ぐための追加チェック制約
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'project_members' 
    AND constraint_name = 'project_members_unique_member'
  ) THEN
    ALTER TABLE public.project_members
    ADD CONSTRAINT project_members_unique_member UNIQUE (project_id, user_id);
  END IF;
END $$;

-- =====================================================
-- 5. updated_at 自動更新トリガー（feature_requests用）
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- feature_requests用のトリガー
DROP TRIGGER IF EXISTS update_feature_requests_updated_at ON public.feature_requests;
CREATE TRIGGER update_feature_requests_updated_at
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- コメント追加
-- =====================================================
COMMENT ON TABLE public.feature_requests IS 'ユーザーからの機能リクエストとバグ報告';
COMMENT ON COLUMN public.profiles.is_admin IS '管理者フラグ（true: 管理者、false: 一般ユーザー）';
COMMENT ON COLUMN public.projects.is_public IS '公開プロジェクトフラグ（将来の機能用）';

