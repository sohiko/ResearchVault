-- ResearchVault Initial Database Schema
-- 作成日: 2024年9月25日

-- UUIDエクステンションを有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Row Level Security (RLS) を有効にするためのセキュリティ設定

-- ============================================================================
-- プロファイルテーブル（Supabase Authと連携）
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (id)
);

-- ============================================================================
-- プロジェクトテーブル
-- ============================================================================
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    color VARCHAR(7) DEFAULT '#3b82f6',
    icon TEXT DEFAULT '📂',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- プロジェクトメンバーテーブル
-- ============================================================================
CREATE TABLE public.project_members (
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('viewer', 'editor', 'admin')) NOT NULL DEFAULT 'viewer',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (project_id, user_id)
);

-- ============================================================================
-- タグテーブル
-- ============================================================================
CREATE TABLE public.tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#6b7280',
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 参照テーブル
-- ============================================================================
CREATE TABLE public.references (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title VARCHAR(500),
    favicon TEXT,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    saved_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    memo TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 参照タグ関連テーブル
-- ============================================================================
CREATE TABLE public.reference_tags (
    reference_id UUID REFERENCES public.references(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (reference_id, tag_id)
);

-- ============================================================================
-- 選択テキストテーブル
-- ============================================================================
CREATE TABLE public.selected_texts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reference_id UUID REFERENCES public.references(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    xpath TEXT,
    context_before VARCHAR(100),
    context_after VARCHAR(100),
    highlight_color VARCHAR(7) DEFAULT '#ffeb3b',
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- ブックマークテーブル
-- ============================================================================
CREATE TABLE public.bookmarks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reference_id UUID REFERENCES public.references(id) ON DELETE CASCADE,
    element_xpath TEXT,
    scroll_position INTEGER DEFAULT 0,
    label VARCHAR(200),
    screenshot TEXT,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 引用設定テーブル
-- ============================================================================
CREATE TABLE public.citation_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    default_style VARCHAR(20) DEFAULT 'APA' CHECK (default_style IN ('APA', 'MLA', 'Chicago', 'Harvard', 'IEEE')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- アクティビティログテーブル
-- ============================================================================
CREATE TABLE public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- インデックスの作成
-- ============================================================================

-- 参照テーブルのインデックス
CREATE INDEX idx_references_project_id ON public.references(project_id);
CREATE INDEX idx_references_saved_by ON public.references(saved_by);
CREATE INDEX idx_references_saved_at ON public.references(saved_at DESC);
CREATE INDEX idx_references_url ON public.references(url);

-- 選択テキストテーブルのインデックス
CREATE INDEX idx_selected_texts_reference_id ON public.selected_texts(reference_id);
CREATE INDEX idx_selected_texts_project_id ON public.selected_texts(project_id);
CREATE INDEX idx_selected_texts_created_by ON public.selected_texts(created_by);

-- ブックマークテーブルのインデックス
CREATE INDEX idx_bookmarks_reference_id ON public.bookmarks(reference_id);
CREATE INDEX idx_bookmarks_project_id ON public.bookmarks(project_id);
CREATE INDEX idx_bookmarks_created_by ON public.bookmarks(created_by);

-- プロジェクトテーブルのインデックス
CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_updated_at ON public.projects(updated_at DESC);

-- アクティビティログのインデックス
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_project_id ON public.activity_logs(project_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- 全文検索インデックス
CREATE INDEX idx_references_search ON public.references USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(memo, '')));
CREATE INDEX idx_selected_texts_search ON public.selected_texts USING gin(to_tsvector('english', text));

-- ============================================================================
-- Row Level Security (RLS) ポリシーの設定
-- ============================================================================

-- プロファイルテーブル
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- プロジェクトテーブル
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects they own or are members of" ON public.projects
    FOR SELECT USING (
        owner_id = auth.uid() OR 
        id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own projects" ON public.projects
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners and admins can update projects" ON public.projects
    FOR UPDATE USING (
        owner_id = auth.uid() OR
        id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() AND role IN ('admin')
        )
    );

CREATE POLICY "Project owners can delete projects" ON public.projects
    FOR DELETE USING (owner_id = auth.uid());

-- プロジェクトメンバーテーブル
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project members for their projects" ON public.project_members
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        ) OR user_id = auth.uid()
    );

CREATE POLICY "Project owners and admins can manage members" ON public.project_members
    FOR ALL USING (
        project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        ) OR (
            project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() AND role = 'admin'
            )
        )
    );

-- 参照テーブル
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view references in their projects" ON public.references
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        ) OR 
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        ) OR
        saved_by = auth.uid()
    );

CREATE POLICY "Users can insert references to their projects" ON public.references
    FOR INSERT WITH CHECK (
        (project_id IN (
            SELECT id FROM public.projects WHERE owner_id = auth.uid()
        ) OR 
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() AND role IN ('editor', 'admin')
        )) AND saved_by = auth.uid()
    );

CREATE POLICY "Users can update own references or project references with permission" ON public.references
    FOR UPDATE USING (
        saved_by = auth.uid() OR
        (project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() AND role IN ('editor', 'admin')
        ))
    );

CREATE POLICY "Users can delete own references or project references with permission" ON public.references
    FOR DELETE USING (
        saved_by = auth.uid() OR
        (project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() AND role IN ('admin')
        ))
    );

-- 選択テキストテーブル
ALTER TABLE public.selected_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own selected texts" ON public.selected_texts
    FOR ALL USING (created_by = auth.uid());

-- ブックマークテーブル
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks
    FOR ALL USING (created_by = auth.uid());

-- タグテーブル
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all tags" ON public.tags
    FOR SELECT USING (true);

CREATE POLICY "Users can create tags" ON public.tags
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own tags" ON public.tags
    FOR UPDATE USING (created_by = auth.uid());

-- 参照タグ関連テーブル
ALTER TABLE public.reference_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage reference tags for accessible references" ON public.reference_tags
    FOR ALL USING (
        reference_id IN (
            SELECT id FROM public.references WHERE saved_by = auth.uid()
        )
    );

-- 引用設定テーブル
ALTER TABLE public.citation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own citation settings" ON public.citation_settings
    FOR ALL USING (user_id = auth.uid());

-- アクティビティログテーブル
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity logs" ON public.activity_logs
    FOR SELECT USING (user_id = auth.uid());

-- ============================================================================
-- トリガー関数とトリガーの作成
-- ============================================================================

-- 更新日時を自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 各テーブルにupdated_at自動更新トリガーを追加
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON public.projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_references_updated_at 
    BEFORE UPDATE ON public.references 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_citation_settings_updated_at 
    BEFORE UPDATE ON public.citation_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ユーザー作成時に自動でプロファイルを作成する関数
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

-- auth.usersテーブルにトリガーを設定
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- アクティビティログを記録する関数
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT操作の場合
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_logs (user_id, project_id, action, resource_type, resource_id, details)
        VALUES (
            COALESCE(NEW.saved_by, NEW.created_by, NEW.owner_id, NEW.user_id),
            COALESCE(NEW.project_id, NEW.id),
            TG_OP,
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
        );
        RETURN NEW;
    END IF;
    
    -- UPDATE操作の場合
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_logs (user_id, project_id, action, resource_type, resource_id, details)
        VALUES (
            COALESCE(NEW.saved_by, NEW.created_by, NEW.owner_id, NEW.user_id),
            COALESCE(NEW.project_id, NEW.id),
            TG_OP,
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
        );
        RETURN NEW;
    END IF;
    
    -- DELETE操作の場合
    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_logs (user_id, project_id, action, resource_type, resource_id, details)
        VALUES (
            COALESCE(OLD.saved_by, OLD.created_by, OLD.owner_id, OLD.user_id),
            COALESCE(OLD.project_id, OLD.id),
            TG_OP,
            TG_TABLE_NAME,
            OLD.id,
            jsonb_build_object('operation', TG_OP, 'table', TG_TABLE_NAME)
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- アクティビティログトリガーを主要テーブルに追加
CREATE TRIGGER log_projects_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_references_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.references
    FOR EACH ROW EXECUTE FUNCTION log_activity();

-- ============================================================================
-- 初期データの挿入
-- ============================================================================

-- デフォルトタグの作成
INSERT INTO public.tags (name, color, created_by) VALUES
    ('論文', '#3b82f6', (SELECT id FROM auth.users LIMIT 1)),
    ('記事', '#10b981', (SELECT id FROM auth.users LIMIT 1)),
    ('書籍', '#f59e0b', (SELECT id FROM auth.users LIMIT 1)),
    ('ウェブサイト', '#8b5cf6', (SELECT id FROM auth.users LIMIT 1)),
    ('重要', '#ef4444', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ビューの作成（レポート用）
-- ============================================================================

-- プロジェクト統計ビュー
CREATE OR REPLACE VIEW project_statistics AS
SELECT 
    p.id,
    p.name,
    p.owner_id,
    COUNT(DISTINCT r.id) as reference_count,
    COUNT(DISTINCT pm.user_id) as member_count,
    COUNT(DISTINCT st.id) as text_count,
    COUNT(DISTINCT b.id) as bookmark_count,
    p.created_at,
    p.updated_at
FROM public.projects p
LEFT JOIN public.references r ON p.id = r.project_id
LEFT JOIN public.project_members pm ON p.id = pm.project_id
LEFT JOIN public.selected_texts st ON p.id = st.project_id
LEFT JOIN public.bookmarks b ON p.id = b.project_id
GROUP BY p.id, p.name, p.owner_id, p.created_at, p.updated_at;

-- ユーザー統計ビュー
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    pr.id,
    pr.name,
    pr.email,
    COUNT(DISTINCT p.id) as owned_projects,
    COUNT(DISTINCT pm.project_id) as member_projects,
    COUNT(DISTINCT r.id) as total_references,
    COUNT(DISTINCT st.id) as total_texts,
    COUNT(DISTINCT b.id) as total_bookmarks,
    pr.created_at
FROM public.profiles pr
LEFT JOIN public.projects p ON pr.id = p.owner_id
LEFT JOIN public.project_members pm ON pr.id = pm.user_id
LEFT JOIN public.references r ON pr.id = r.saved_by
LEFT JOIN public.selected_texts st ON pr.id = st.created_by
LEFT JOIN public.bookmarks b ON pr.id = b.created_by
GROUP BY pr.id, pr.name, pr.email, pr.created_at;

-- ============================================================================
-- エラーハンドリング用関数
-- ============================================================================

-- URL重複チェック関数
CREATE OR REPLACE FUNCTION check_reference_duplicate(
    p_project_id UUID,
    p_url TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.references 
        WHERE project_id = p_project_id AND url = p_url
    );
END;
$$ LANGUAGE plpgsql;

-- プロジェクトメンバー権限チェック関数
CREATE OR REPLACE FUNCTION check_project_permission(
    p_project_id UUID,
    p_user_id UUID,
    p_required_role TEXT DEFAULT 'viewer'
) RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    is_owner BOOLEAN;
BEGIN
    -- オーナーかチェック
    SELECT EXISTS(
        SELECT 1 FROM public.projects 
        WHERE id = p_project_id AND owner_id = p_user_id
    ) INTO is_owner;
    
    IF is_owner THEN
        RETURN TRUE;
    END IF;
    
    -- メンバーロールをチェック
    SELECT role INTO user_role
    FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id;
    
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 権限レベルをチェック
    CASE p_required_role
        WHEN 'viewer' THEN RETURN user_role IN ('viewer', 'editor', 'admin');
        WHEN 'editor' THEN RETURN user_role IN ('editor', 'admin');
        WHEN 'admin' THEN RETURN user_role = 'admin';
        ELSE RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- コメント追加
COMMENT ON TABLE public.profiles IS 'ユーザープロファイル情報';
COMMENT ON TABLE public.projects IS '研究プロジェクト';
COMMENT ON TABLE public.project_members IS 'プロジェクトメンバーシップ';
COMMENT ON TABLE public.references IS '保存された参照資料';
COMMENT ON TABLE public.selected_texts IS '選択されたテキスト';
COMMENT ON TABLE public.bookmarks IS 'ページ内ブックマーク';
COMMENT ON TABLE public.tags IS 'タグマスター';
COMMENT ON TABLE public.reference_tags IS '参照とタグの関連';
COMMENT ON TABLE public.citation_settings IS '引用スタイル設定';
COMMENT ON TABLE public.activity_logs IS 'アクティビティログ';
