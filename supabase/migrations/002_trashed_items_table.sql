-- ゴミ箱機能のための削除アイテム追跡テーブル
-- 作成日: 2024年9月25日

-- ============================================================================
-- 削除アイテム追跡テーブル
-- ============================================================================
CREATE TABLE public.trashed_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    original_id UUID NOT NULL,
    original_table VARCHAR(50) NOT NULL CHECK (original_table IN ('references', 'projects', 'selected_texts', 'bookmarks')),
    original_data JSONB NOT NULL,
    deleted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    restore_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '30 days')
);

-- ============================================================================
-- 履歴候補テーブル（記録漏れ候補機能用）
-- ============================================================================
CREATE TABLE public.browsing_history_candidates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    favicon TEXT,
    visited_at TIMESTAMP WITH TIME ZONE NOT NULL,
    visit_count INTEGER DEFAULT 1,
    last_visit TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    domain TEXT,
    is_academic BOOLEAN DEFAULT false,
    confidence_score DECIMAL(3,2) DEFAULT 0.5,
    suggested_reason TEXT,
    dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- インデックスの作成
-- ============================================================================

-- 削除アイテムテーブルのインデックス
CREATE INDEX idx_trashed_items_deleted_by ON public.trashed_items(deleted_by);
CREATE INDEX idx_trashed_items_deleted_at ON public.trashed_items(deleted_at DESC);
CREATE INDEX idx_trashed_items_project_id ON public.trashed_items(project_id);
CREATE INDEX idx_trashed_items_original_table ON public.trashed_items(original_table);
CREATE INDEX idx_trashed_items_restore_expires ON public.trashed_items(restore_expires_at);

-- 履歴候補テーブルのインデックス
CREATE INDEX idx_browsing_candidates_user_id ON public.browsing_history_candidates(user_id);
CREATE INDEX idx_browsing_candidates_visited_at ON public.browsing_history_candidates(visited_at DESC);
CREATE INDEX idx_browsing_candidates_url ON public.browsing_history_candidates(url);
CREATE INDEX idx_browsing_candidates_domain ON public.browsing_history_candidates(domain);
CREATE INDEX idx_browsing_candidates_academic ON public.browsing_history_candidates(is_academic);
CREATE INDEX idx_browsing_candidates_dismissed ON public.browsing_history_candidates(dismissed);

-- ============================================================================
-- Row Level Security (RLS) ポリシーの設定
-- ============================================================================

-- 削除アイテムテーブル
ALTER TABLE public.trashed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trashed items" ON public.trashed_items
    FOR SELECT USING (deleted_by = auth.uid());

CREATE POLICY "Users can insert own trashed items" ON public.trashed_items
    FOR INSERT WITH CHECK (deleted_by = auth.uid());

CREATE POLICY "Users can delete own trashed items" ON public.trashed_items
    FOR DELETE USING (deleted_by = auth.uid());

-- 履歴候補テーブル
ALTER TABLE public.browsing_history_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own browsing candidates" ON public.browsing_history_candidates
    FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- トリガー関数とトリガーの作成
-- ============================================================================

-- 削除時に自動でゴミ箱に移動する関数（参照用）
CREATE OR REPLACE FUNCTION move_to_trash()
RETURNS TRIGGER AS $$
BEGIN
    -- 削除されたアイテムをゴミ箱テーブルに保存
    INSERT INTO public.trashed_items (
        original_id,
        original_table,
        original_data,
        deleted_by,
        project_id
    ) VALUES (
        OLD.id,
        TG_TABLE_NAME,
        row_to_json(OLD),
        COALESCE(OLD.saved_by, OLD.created_by, OLD.owner_id),
        OLD.project_id
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 参照削除時のトリガー
CREATE TRIGGER references_to_trash
    BEFORE DELETE ON public.references
    FOR EACH ROW EXECUTE FUNCTION move_to_trash();

-- プロジェクト削除時のトリガー  
CREATE TRIGGER projects_to_trash
    BEFORE DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION move_to_trash();

-- 選択テキスト削除時のトリガー
CREATE TRIGGER selected_texts_to_trash
    BEFORE DELETE ON public.selected_texts
    FOR EACH ROW EXECUTE FUNCTION move_to_trash();

-- ブックマーク削除時のトリガー
CREATE TRIGGER bookmarks_to_trash
    BEFORE DELETE ON public.bookmarks
    FOR EACH ROW EXECUTE FUNCTION move_to_trash();

-- ============================================================================
-- 履歴候補分析関数
-- ============================================================================

-- 学術サイトかどうかを判定する関数
CREATE OR REPLACE FUNCTION is_academic_domain(domain_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN domain_name ~ '\.(edu|ac\.|gov)$' OR 
           domain_name IN (
               'scholar.google.com',
               'pubmed.ncbi.nlm.nih.gov',
               'arxiv.org',
               'researchgate.net',
               'nature.com',
               'science.org',
               'ieee.org',
               'springer.com',
               'wiley.com',
               'sciencedirect.com',
               'jstor.org',
               'nih.gov',
               'who.int',
               'un.org',
               'ipcc.ch'
           );
END;
$$ LANGUAGE plpgsql;

-- 信頼度スコアを計算する関数
CREATE OR REPLACE FUNCTION calculate_confidence_score(
    url_param TEXT,
    title_param TEXT,
    visit_count_param INTEGER,
    domain_param TEXT
)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    score DECIMAL(3,2) := 0.3;
BEGIN
    -- 学術ドメインの場合は高スコア
    IF is_academic_domain(domain_param) THEN
        score := score + 0.4;
    END IF;
    
    -- 訪問回数による加点
    IF visit_count_param > 1 THEN
        score := score + LEAST(visit_count_param * 0.1, 0.3);
    END IF;
    
    -- タイトルにキーワードが含まれる場合の加点
    IF title_param ~* '(research|study|analysis|paper|journal|article|thesis|dissertation)' THEN
        score := score + 0.2;
    END IF;
    
    -- URLにキーワードが含まれる場合の加点
    IF url_param ~* '(research|scholar|academic|journal|paper|article|study)' THEN
        score := score + 0.1;
    END IF;
    
    RETURN LEAST(score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- 既存の参照と重複チェック関数
CREATE OR REPLACE FUNCTION is_already_saved_reference(
    user_id_param UUID,
    url_param TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.references 
        WHERE saved_by = user_id_param AND url = url_param
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 期限切れアイテム自動削除関数
-- ============================================================================

-- 期限切れのゴミ箱アイテムを削除する関数
CREATE OR REPLACE FUNCTION cleanup_expired_trash()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.trashed_items 
    WHERE restore_expires_at < timezone('utc'::text, now());
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- コメント追加
COMMENT ON TABLE public.trashed_items IS '削除されたアイテムの一時保存（30日間）';
COMMENT ON TABLE public.browsing_history_candidates IS '記録漏れ候補の履歴データ';
COMMENT ON FUNCTION move_to_trash() IS 'アイテム削除時に自動でゴミ箱に移動';
COMMENT ON FUNCTION is_academic_domain(TEXT) IS '学術ドメインかどうかの判定';
COMMENT ON FUNCTION calculate_confidence_score(TEXT, TEXT, INTEGER, TEXT) IS '候補の信頼度スコア計算';
COMMENT ON FUNCTION cleanup_expired_trash() IS '期限切れゴミ箱アイテムの自動削除';
