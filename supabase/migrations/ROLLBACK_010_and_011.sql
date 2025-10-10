-- マイグレーション 010 と 011 を完全にロールバック
-- 警告: このSQLを実行すると、記録漏れ候補データがすべて削除されます

-- 011で追加されたカラムを削除
ALTER TABLE public.browsing_history_candidates
DROP COLUMN IF EXISTS subject,
DROP COLUMN IF EXISTS subject_confidence,
DROP COLUMN IF EXISTS ai_classified,
DROP COLUMN IF EXISTS classification_result,
DROP COLUMN IF EXISTS classified_at;

-- 011で追加されたインデックスを削除
DROP INDEX IF EXISTS public.idx_candidates_subject;
DROP INDEX IF EXISTS public.idx_candidates_ai_classified;

-- 010で作成されたテーブルを削除
DROP TABLE IF EXISTS public.ai_classification_cache CASCADE;
DROP TABLE IF EXISTS public.subject_tags CASCADE;
DROP TABLE IF EXISTS public.browsing_history_candidates CASCADE;

-- 確認メッセージ
DO $$
BEGIN
  RAISE NOTICE '✓ マイグレーション 010 と 011 のロールバックが完了しました';
  RAISE NOTICE '✓ すべての記録漏れ候補データが削除されました';
END $$;


