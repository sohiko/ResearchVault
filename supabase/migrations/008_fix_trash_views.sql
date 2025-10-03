-- ゴミ箱ビューの修正
-- security_invoker = on を追加してAPIアクセスを改善

-- 既存のビューを削除
DROP VIEW IF EXISTS trash_projects;
DROP VIEW IF EXISTS trash_references;

-- security_invoker = on を追加してビューを再作成
CREATE VIEW trash_projects WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  description,
  owner_id,
  color,
  icon,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_in_trash,
  30 - EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_until_permanent_deletion
FROM projects 
WHERE deleted_at IS NOT NULL;

CREATE VIEW trash_references WITH (security_invoker = on) AS
SELECT 
  id,
  title,
  url,
  memo,
  project_id,
  saved_by,
  created_at,
  updated_at,
  deleted_at,
  deleted_by,
  EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_in_trash,
  30 - EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_until_permanent_deletion
FROM "references" 
WHERE deleted_at IS NOT NULL;

-- ビューはベースとなるテーブルのRLSポリシーを継承するため、
-- 個別のRLS設定は不要です。
-- security_invoker = on により、ビューにアクセスするユーザーの権限で
-- ベーステーブルのRLSポリシーが適用されます。
