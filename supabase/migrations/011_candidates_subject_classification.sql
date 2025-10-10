-- 記録漏れ候補テーブルに教科分類カラムを追加

-- 教科カラムを追加
ALTER TABLE public.browsing_history_candidates
ADD COLUMN IF NOT EXISTS subject character varying CHECK (subject IN (
  '国語', '数学', '歴史', '物理', '生物', '化学', 
  '地理', '英語', '音楽', '美術', '技術', '家庭科', 'その他'
)),
ADD COLUMN IF NOT EXISTS subject_confidence numeric(3,2) DEFAULT NULL CHECK (subject_confidence >= 0 AND subject_confidence <= 1),
ADD COLUMN IF NOT EXISTS ai_classified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS classification_result jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS classified_at timestamp with time zone DEFAULT NULL;

-- インデックスの追加
CREATE INDEX IF NOT EXISTS idx_candidates_subject 
  ON public.browsing_history_candidates(subject);

CREATE INDEX IF NOT EXISTS idx_candidates_ai_classified 
  ON public.browsing_history_candidates(ai_classified);

-- コメント
COMMENT ON COLUMN public.browsing_history_candidates.subject IS '教科分類（AI自動分類または手動）';
COMMENT ON COLUMN public.browsing_history_candidates.subject_confidence IS '分類の信頼度（0.0-1.0）';
COMMENT ON COLUMN public.browsing_history_candidates.ai_classified IS 'AI分類フラグ';
COMMENT ON COLUMN public.browsing_history_candidates.classification_result IS 'AI分類の詳細結果（JSON）';
COMMENT ON COLUMN public.browsing_history_candidates.classified_at IS '分類実行日時';

-- subject_tags と ai_classification_cache テーブルを削除（参照用ではなく候補用に変更）
-- これらは前回のマイグレーションで作成されたが、設計変更のため不要
DROP TABLE IF EXISTS public.ai_classification_cache CASCADE;
DROP TABLE IF EXISTS public.subject_tags CASCADE;


