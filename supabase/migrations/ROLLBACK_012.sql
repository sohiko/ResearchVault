-- Rollback migration 012
-- 警告: このスクリプトを実行すると、browsing_history_candidatesテーブルから追加されたカラムが削除されます

-- RLSポリシーを削除
DROP POLICY IF EXISTS "Users can delete their own candidates" ON public.browsing_history_candidates;
DROP POLICY IF EXISTS "Users can update their own candidates" ON public.browsing_history_candidates;
DROP POLICY IF EXISTS "Users can insert their own candidates" ON public.browsing_history_candidates;
DROP POLICY IF EXISTS "Users can view their own candidates" ON public.browsing_history_candidates;

-- RLSを無効化
ALTER TABLE public.browsing_history_candidates DISABLE ROW LEVEL SECURITY;

-- インデックスを削除
DROP INDEX IF EXISTS idx_candidates_subject;
DROP INDEX IF EXISTS idx_candidates_visited_at;
DROP INDEX IF EXISTS idx_candidates_dismissed;
DROP INDEX IF EXISTS idx_candidates_user_id;

-- 外部キー制約を削除
ALTER TABLE public.browsing_history_candidates
DROP CONSTRAINT IF EXISTS browsing_history_candidates_user_id_fkey;

-- カラムを削除
ALTER TABLE public.browsing_history_candidates
DROP COLUMN IF EXISTS favicon,
DROP COLUMN IF EXISTS dismissed_at,
DROP COLUMN IF EXISTS dismissed,
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS is_academic,
DROP COLUMN IF EXISTS suggested_reason,
DROP COLUMN IF EXISTS confidence_score,
DROP COLUMN IF EXISTS visit_count,
DROP COLUMN IF EXISTS visited_at,
DROP COLUMN IF EXISTS user_id;

-- コメントを削除
COMMENT ON TABLE public.browsing_history_candidates IS NULL;

