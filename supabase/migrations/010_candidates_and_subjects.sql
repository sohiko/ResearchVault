-- 記録漏れ候補テーブルの作成
CREATE TABLE IF NOT EXISTS public.browsing_history_candidates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  title character varying,
  favicon text,
  visited_at timestamp with time zone NOT NULL,
  visit_count integer DEFAULT 1,
  confidence_score numeric(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  suggested_reason character varying,
  is_academic boolean DEFAULT false,
  category character varying,
  dismissed boolean DEFAULT false,
  dismissed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT browsing_history_candidates_pkey PRIMARY KEY (id),
  CONSTRAINT browsing_history_candidates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_browsing_history_candidates_user_id 
  ON public.browsing_history_candidates(user_id);

CREATE INDEX IF NOT EXISTS idx_browsing_history_candidates_dismissed 
  ON public.browsing_history_candidates(dismissed);

CREATE INDEX IF NOT EXISTS idx_browsing_history_candidates_visited_at 
  ON public.browsing_history_candidates(visited_at DESC);

-- 教科タグテーブルの作成
CREATE TABLE IF NOT EXISTS public.subject_tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reference_id uuid NOT NULL,
  subject character varying NOT NULL CHECK (subject IN (
    '国語', '数学', '歴史', '物理', '生物', '化学', 
    '地理', '英語', '音楽', '美術', '技術', '家庭科', 'その他'
  )),
  confidence numeric(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  ai_classified boolean DEFAULT false,
  classified_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subject_tags_pkey PRIMARY KEY (id),
  CONSTRAINT subject_tags_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES public.references(id) ON DELETE CASCADE,
  CONSTRAINT subject_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT subject_tags_unique UNIQUE (reference_id, subject)
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_subject_tags_reference_id 
  ON public.subject_tags(reference_id);

CREATE INDEX IF NOT EXISTS idx_subject_tags_subject 
  ON public.subject_tags(subject);

-- AI分類履歴テーブルの作成（Gemini APIの重複呼び出しを防ぐ）
CREATE TABLE IF NOT EXISTS public.ai_classification_cache (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reference_id uuid NOT NULL UNIQUE,
  url text NOT NULL,
  title character varying,
  classification_result jsonb NOT NULL,
  model_used character varying DEFAULT 'gemini-1.5-flash',
  tokens_used integer,
  classified_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ai_classification_cache_pkey PRIMARY KEY (id),
  CONSTRAINT ai_classification_cache_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES public.references(id) ON DELETE CASCADE
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_ai_classification_cache_reference_id 
  ON public.ai_classification_cache(reference_id);

CREATE INDEX IF NOT EXISTS idx_ai_classification_cache_url 
  ON public.ai_classification_cache(url);

-- RLS (Row Level Security) ポリシーの設定

-- browsing_history_candidates
ALTER TABLE public.browsing_history_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own candidates"
  ON public.browsing_history_candidates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own candidates"
  ON public.browsing_history_candidates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidates"
  ON public.browsing_history_candidates
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own candidates"
  ON public.browsing_history_candidates
  FOR DELETE
  USING (auth.uid() = user_id);

-- subject_tags
ALTER TABLE public.subject_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subject tags for their references"
  ON public.subject_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.references r
      WHERE r.id = subject_tags.reference_id
      AND (r.saved_by = auth.uid() OR r.project_id IN (
        SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can insert subject tags for their references"
  ON public.subject_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.references r
      WHERE r.id = subject_tags.reference_id
      AND r.saved_by = auth.uid()
    )
  );

CREATE POLICY "Users can update subject tags for their references"
  ON public.subject_tags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.references r
      WHERE r.id = subject_tags.reference_id
      AND r.saved_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete subject tags for their references"
  ON public.subject_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.references r
      WHERE r.id = subject_tags.reference_id
      AND r.saved_by = auth.uid()
    )
  );

-- ai_classification_cache
ALTER TABLE public.ai_classification_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI classification for their references"
  ON public.ai_classification_cache
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.references r
      WHERE r.id = ai_classification_cache.reference_id
      AND (r.saved_by = auth.uid() OR r.project_id IN (
        SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can insert AI classification for their references"
  ON public.ai_classification_cache
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.references r
      WHERE r.id = ai_classification_cache.reference_id
      AND r.saved_by = auth.uid()
    )
  );

-- コメント
COMMENT ON TABLE public.browsing_history_candidates IS '記録漏れ候補として検出されたブラウジング履歴';
COMMENT ON TABLE public.subject_tags IS '参照の教科タグ（AI分類または手動）';
COMMENT ON TABLE public.ai_classification_cache IS 'AI分類結果のキャッシュ（Gemini API重複呼び出し防止）';

