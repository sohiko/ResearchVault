-- browsing_history_candidatesテーブルにuser_idとurlの組み合わせでUNIQUE制約を追加
-- これにより、同じユーザーが同じURLの候補を複数回保存することを防ぎます

-- 既存の重複データをクリーンアップ（最新のものを残す）
DELETE FROM public.browsing_history_candidates a
USING public.browsing_history_candidates b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.url = b.url;

-- UNIQUE制約を追加
ALTER TABLE public.browsing_history_candidates
ADD CONSTRAINT browsing_history_candidates_user_url_unique 
UNIQUE (user_id, url);

-- インデックスも追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_browsing_history_candidates_user_url 
  ON public.browsing_history_candidates(user_id, url);

