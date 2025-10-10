-- 欠落しているカラムを追加
ALTER TABLE public.browsing_history_candidates
ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL,
ADD COLUMN IF NOT EXISTS visited_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS visit_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS confidence_score numeric(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
ADD COLUMN IF NOT EXISTS suggested_reason character varying,
ADD COLUMN IF NOT EXISTS is_academic boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS category character varying,
ADD COLUMN IF NOT EXISTS dismissed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dismissed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS favicon text;

-- 外部キー制約を追加
ALTER TABLE public.browsing_history_candidates
ADD CONSTRAINT browsing_history_candidates_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.browsing_history_candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_dismissed ON public.browsing_history_candidates(dismissed);
CREATE INDEX IF NOT EXISTS idx_candidates_visited_at ON public.browsing_history_candidates(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_subject ON public.browsing_history_candidates(subject);

-- RLSポリシーを追加
ALTER TABLE public.browsing_history_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own candidates"
  ON public.browsing_history_candidates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own candidates"
  ON public.browsing_history_candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own candidates"
  ON public.browsing_history_candidates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own candidates"
  ON public.browsing_history_candidates FOR DELETE
  USING (auth.uid() = user_id);

-- コメント
COMMENT ON TABLE public.browsing_history_candidates IS '記録漏れ候補として検出されたブラウジング履歴';
COMMENT ON COLUMN public.browsing_history_candidates.user_id IS 'ユーザーID';
COMMENT ON COLUMN public.browsing_history_candidates.visited_at IS '訪問日時';
COMMENT ON COLUMN public.browsing_history_candidates.confidence_score IS '候補の信頼度（0.0-1.0）';
COMMENT ON COLUMN public.browsing_history_candidates.suggested_reason IS '候補として提案する理由';
COMMENT ON COLUMN public.browsing_history_candidates.is_academic IS '学術サイトフラグ';
COMMENT ON COLUMN public.browsing_history_candidates.dismissed IS '却下フラグ';

