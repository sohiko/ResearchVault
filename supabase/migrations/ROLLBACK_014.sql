-- ROLLBACK_014.sql
-- 014_comprehensive_fixes.sql のロールバック用スクリプト

-- feature_requests テーブルの削除
DROP TABLE IF EXISTS public.feature_requests CASCADE;

-- profiles テーブルから is_admin カラムを削除
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- projects テーブルから is_public カラムを削除
ALTER TABLE public.projects DROP COLUMN IF EXISTS is_public;

-- project_members の制約を削除
ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_unique_member;

-- トリガー関数の削除
DROP TRIGGER IF EXISTS update_feature_requests_updated_at ON public.feature_requests;
DROP FUNCTION IF EXISTS update_updated_at_column();

