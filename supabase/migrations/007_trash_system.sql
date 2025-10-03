-- ゴミ箱システムの実装
-- プロジェクトと参照にdeleted_atとdeleted_byカラムを追加

-- プロジェクトテーブルにゴミ箱機能を追加
ALTER TABLE projects 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- 参照テーブルにゴミ箱機能を追加
ALTER TABLE "references" 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- ゴミ箱のインデックスを作成（パフォーマンス向上）
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_references_deleted_at ON "references"(deleted_at) WHERE deleted_at IS NOT NULL;

-- 30日後の自動削除のための関数
CREATE OR REPLACE FUNCTION cleanup_old_trash()
RETURNS void AS $$
BEGIN
  -- 30日以上前に削除されたプロジェクトを完全削除
  DELETE FROM projects 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  -- 30日以上前に削除された参照を完全削除
  DELETE FROM "references" 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 毎日実行される自動クリーンアップのスケジュール設定
-- 注意: この部分はSupabaseの管理画面で手動設定が必要
-- SELECT cron.schedule('cleanup-trash', '0 2 * * *', 'SELECT cleanup_old_trash();');

-- プロジェクト削除時に参照も一緒に削除するトリガー関数
CREATE OR REPLACE FUNCTION soft_delete_project_references()
RETURNS TRIGGER AS $$
BEGIN
  -- プロジェクトが削除された場合、そのプロジェクトの参照も削除
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE "references" 
    SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
    WHERE project_id = NEW.id AND deleted_at IS NULL;
  END IF;
  
  -- プロジェクトが復元された場合、そのプロジェクトの参照も復元
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE "references" 
    SET deleted_at = NULL, deleted_by = NULL
    WHERE project_id = NEW.id AND deleted_by = OLD.deleted_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成
CREATE TRIGGER trigger_soft_delete_project_references
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_project_references();

-- RLSポリシーを更新（削除されたアイテムは通常のクエリから除外）
-- プロジェクトの既存ポリシーを削除して再作成
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- 新しいポリシー（削除されていないもののみ）
CREATE POLICY "Users can view their own active projects" ON projects
  FOR SELECT USING (auth.uid() = owner_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = owner_id);

-- 削除されたプロジェクトに対する追加ポリシー
CREATE POLICY "Users can view their own deleted projects" ON projects
  FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

CREATE POLICY "Users can update deleted projects they deleted" ON projects
  FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

-- 参照の既存ポリシーを削除して再作成
DROP POLICY IF EXISTS "Users can view their own references" ON "references";
DROP POLICY IF EXISTS "Users can insert their own references" ON "references";
DROP POLICY IF EXISTS "Users can update their own references" ON "references";
DROP POLICY IF EXISTS "Users can delete their own references" ON "references";

-- 新しいポリシー（削除されていないもののみ）
CREATE POLICY "Users can view their own active references" ON "references"
  FOR SELECT USING (auth.uid() = saved_by AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own references" ON "references"
  FOR INSERT WITH CHECK (auth.uid() = saved_by);

CREATE POLICY "Users can update their own references" ON "references"
  FOR UPDATE USING (auth.uid() = saved_by);

-- 削除された参照に対する追加ポリシー
CREATE POLICY "Users can view their own deleted references" ON "references"
  FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

CREATE POLICY "Users can update deleted references they deleted" ON "references"
  FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

-- ゴミ箱専用のビュー（削除されたアイテムのみ）
CREATE OR REPLACE VIEW trash_projects AS
SELECT 
  *,
  EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_in_trash,
  30 - EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_until_permanent_deletion
FROM projects 
WHERE deleted_at IS NOT NULL;

CREATE OR REPLACE VIEW trash_references AS
SELECT 
  *,
  EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_in_trash,
  30 - EXTRACT(DAYS FROM (NOW() - deleted_at)) as days_until_permanent_deletion
FROM "references" 
WHERE deleted_at IS NOT NULL;

-- 注意: 削除されたアイテムへのアクセスポリシーは上記で既に作成済み
