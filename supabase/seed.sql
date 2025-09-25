-- ResearchVault 初期データ
-- このファイルは開発・テスト環境での初期データ投入用です

-- ============================================================================
-- デモユーザーの作成（開発環境のみ）
-- ============================================================================

-- 注意: 本番環境では実行しないでください
-- これらのユーザーはテスト用途のみです

-- デモプロファイルの作成（実際のauth.usersレコードが必要）
-- 実際の使用時はSupabaseの認証機能でユーザーが作成されてから、
-- トリガーによって自動的にプロファイルが作成されます

-- ============================================================================
-- サンプルタグの作成
-- ============================================================================

INSERT INTO public.tags (id, name, color) VALUES
    (uuid_generate_v4(), '論文', '#3b82f6'),
    (uuid_generate_v4(), '記事', '#10b981'),
    (uuid_generate_v4(), '書籍', '#f59e0b'),
    (uuid_generate_v4(), 'ウェブサイト', '#8b5cf6'),
    (uuid_generate_v4(), '重要', '#ef4444'),
    (uuid_generate_v4(), 'IB', '#06b6d4'),
    (uuid_generate_v4(), 'Extended Essay', '#84cc16'),
    (uuid_generate_v4(), 'TOK', '#f97316'),
    (uuid_generate_v4(), 'CAS', '#ec4899'),
    (uuid_generate_v4(), 'IA', '#6366f1'),
    (uuid_generate_v4(), '科学', '#22c55e'),
    (uuid_generate_v4(), '歴史', '#a855f7'),
    (uuid_generate_v4(), '文学', '#f43f5e'),
    (uuid_generate_v4(), '数学', '#0ea5e9'),
    (uuid_generate_v4(), '哲学', '#64748b')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- サンプル引用スタイル設定
-- ============================================================================

-- デフォルトの引用スタイル設定テンプレート
-- 実際のユーザーが作成されたときに、これらの設定が自動で作成されます

-- APA 7th Edition 設定例
CREATE OR REPLACE FUNCTION create_default_citation_settings(user_uuid UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.citation_settings (user_id, default_style, settings)
    VALUES (
        user_uuid,
        'APA',
        jsonb_build_object(
            'apa_settings', jsonb_build_object(
                'version', '7th',
                'doi_format', 'https://doi.org/',
                'hanging_indent', true,
                'double_spacing', true
            ),
            'mla_settings', jsonb_build_object(
                'version', '9th',
                'hanging_indent', true,
                'double_spacing', true
            ),
            'chicago_settings', jsonb_build_object(
                'version', '17th',
                'style', 'author-date',
                'hanging_indent', true
            )
        )
    )
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- サンプルプロジェクトテンプレート
-- ============================================================================

-- IBプログラム用のプロジェクトテンプレートを作成する関数
CREATE OR REPLACE FUNCTION create_ib_project_templates(user_uuid UUID)
RETURNS void AS $$
DECLARE
    ee_project_id UUID;
    tok_project_id UUID;
    cas_project_id UUID;
BEGIN
    -- Extended Essay プロジェクト
    INSERT INTO public.projects (id, name, description, owner_id, color, icon)
    VALUES (
        uuid_generate_v4(),
        'Extended Essay',
        'IB Extended Essay 研究プロジェクト。4000語の独立研究論文です。',
        user_uuid,
        '#84cc16',
        '📝'
    ) RETURNING id INTO ee_project_id;
    
    -- TOK Essay プロジェクト
    INSERT INTO public.projects (id, name, description, owner_id, color, icon)
    VALUES (
        uuid_generate_v4(),
        'TOK Essay',
        'Theory of Knowledge エッセイプロジェクト。知識の本質について探究します。',
        user_uuid,
        '#f97316',
        '💭'
    ) RETURNING id INTO tok_project_id;
    
    -- CAS プロジェクト
    INSERT INTO public.projects (id, name, description, owner_id, color, icon)
    VALUES (
        uuid_generate_v4(),
        'CAS Activities',
        'Creativity, Activity, Service プロジェクト。課外活動の記録と反思です。',
        user_uuid,
        '#ec4899',
        '🎯'
    ) RETURNING id INTO cas_project_id;
    
    -- プロジェクトオーナーをメンバーとして追加
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES 
        (ee_project_id, user_uuid, 'admin'),
        (tok_project_id, user_uuid, 'admin'),
        (cas_project_id, user_uuid, 'admin');
        
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ヘルプ・チュートリアル用のサンプルデータ
-- ============================================================================

-- チュートリアル用のサンプル参照を作成する関数
CREATE OR REPLACE FUNCTION create_tutorial_references(user_uuid UUID, project_uuid UUID)
RETURNS void AS $$
DECLARE
    ref_id UUID;
BEGIN
    -- サンプル参照1: 学術論文
    INSERT INTO public.references (id, project_id, url, title, saved_by, memo, metadata)
    VALUES (
        uuid_generate_v4(),
        project_uuid,
        'https://www.jstor.org/stable/sample-paper',
        'Sample Academic Paper on Research Methods',
        user_uuid,
        'これは研究方法に関する重要な論文です。第3章の統計手法が特に参考になります。',
        jsonb_build_object(
            'author', 'Smith, J. & Johnson, A.',
            'publishedDate', '2023-03-15',
            'description', 'A comprehensive study on modern research methodologies',
            'siteName', 'JSTOR',
            'type', 'article'
        )
    ) RETURNING id INTO ref_id;
    
    -- サンプル選択テキスト
    INSERT INTO public.selected_texts (reference_id, text, context_before, context_after, project_id, created_by)
    VALUES (
        ref_id,
        'Research methodology is fundamental to any academic inquiry.',
        'In conclusion, we can state that ',
        ' This principle guides our entire approach.',
        project_uuid,
        user_uuid
    );
    
    -- サンプル参照2: ウェブサイト
    INSERT INTO public.references (id, project_id, url, title, saved_by, memo, metadata)
    VALUES (
        uuid_generate_v4(),
        project_uuid,
        'https://www.ibo.org/programmes/diploma-programme/',
        'Diploma Programme - International Baccalaureate',
        user_uuid,
        'IBディプロマプログラムの公式情報。Extended Essayの要件について詳しく記載されています。',
        jsonb_build_object(
            'author', 'International Baccalaureate Organization',
            'description', 'Official information about the IB Diploma Programme',
            'siteName', 'IBO',
            'type', 'website'
        )
    );
    
    -- サンプル参照3: 書籍
    INSERT INTO public.references (id, project_id, url, title, saved_by, memo, metadata)
    VALUES (
        uuid_generate_v4(),
        project_uuid,
        'https://www.example-publisher.com/academic-writing-guide',
        'The Complete Guide to Academic Writing',
        user_uuid,
        'アカデミックライティングの包括的なガイド。引用方法とエッセイ構造について詳しく解説されています。',
        jsonb_build_object(
            'author', 'Williams, M.',
            'publishedDate', '2022-09-20',
            'description', 'A comprehensive guide to academic writing and citation',
            'siteName', 'Academic Press',
            'type', 'book'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 開発環境用のテストデータ作成関数
-- ============================================================================

-- 開発環境でテストデータを一括作成する関数
CREATE OR REPLACE FUNCTION create_development_test_data()
RETURNS void AS $$
DECLARE
    test_user_id UUID;
    test_project_id UUID;
BEGIN
    -- この関数は開発環境でのみ実行すること
    -- 本番環境では絶対に実行しないでください
    
    RAISE NOTICE 'Creating development test data...';
    
    -- テストユーザーのプロファイルが存在する場合のみ実行
    SELECT id INTO test_user_id FROM public.profiles LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- デフォルト引用設定を作成
        PERFORM create_default_citation_settings(test_user_id);
        
        -- IBプロジェクトテンプレートを作成
        PERFORM create_ib_project_templates(test_user_id);
        
        -- 最初のプロジェクトにチュートリアル参照を追加
        SELECT id INTO test_project_id FROM public.projects WHERE owner_id = test_user_id LIMIT 1;
        
        IF test_project_id IS NOT NULL THEN
            PERFORM create_tutorial_references(test_user_id, test_project_id);
        END IF;
        
        RAISE NOTICE 'Development test data created successfully for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'No user profiles found. Test data not created.';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 便利な管理用関数
-- ============================================================================

-- データベースの統計情報を取得する関数
CREATE OR REPLACE FUNCTION get_database_statistics()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'profiles'::TEXT, COUNT(*)::BIGINT FROM public.profiles
    UNION ALL
    SELECT 'projects'::TEXT, COUNT(*)::BIGINT FROM public.projects
    UNION ALL
    SELECT 'project_members'::TEXT, COUNT(*)::BIGINT FROM public.project_members
    UNION ALL
    SELECT 'references'::TEXT, COUNT(*)::BIGINT FROM public.references
    UNION ALL
    SELECT 'selected_texts'::TEXT, COUNT(*)::BIGINT FROM public.selected_texts
    UNION ALL
    SELECT 'bookmarks'::TEXT, COUNT(*)::BIGINT FROM public.bookmarks
    UNION ALL
    SELECT 'tags'::TEXT, COUNT(*)::BIGINT FROM public.tags
    UNION ALL
    SELECT 'activity_logs'::TEXT, COUNT(*)::BIGINT FROM public.activity_logs;
END;
$$ LANGUAGE plpgsql;

-- テストデータをクリーンアップする関数（開発環境用）
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS void AS $$
BEGIN
    -- 注意: この関数は開発環境でのみ使用してください
    RAISE NOTICE 'Cleaning up test data...';
    
    DELETE FROM public.activity_logs;
    DELETE FROM public.reference_tags;
    DELETE FROM public.selected_texts;
    DELETE FROM public.bookmarks;
    DELETE FROM public.references;
    DELETE FROM public.project_members;
    DELETE FROM public.projects;
    DELETE FROM public.citation_settings;
    -- プロファイルとタグは保持
    
    RAISE NOTICE 'Test data cleanup completed.';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 実行コメント
-- ============================================================================

-- 以下のコマンドは手動で実行してください（必要な場合のみ）:
-- 
-- 開発環境でテストデータを作成する場合:
-- SELECT create_development_test_data();
--
-- データベース統計を確認する場合:
-- SELECT * FROM get_database_statistics();
--
-- テストデータをクリーンアップする場合（注意して実行）:
-- SELECT cleanup_test_data();
