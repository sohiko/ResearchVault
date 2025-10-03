-- ゴミ箱システム - 最小限の実装
-- 既存のポリシーを変更せず、カラムとポリシーのみ追加

-- ステップ1: カラム追加（既存の場合はスキップ）
DO $$
BEGIN
  -- プロジェクトテーブル
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_at') THEN
    ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_by') THEN
    ALTER TABLE projects ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  -- 参照テーブル
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'references' AND column_name = 'deleted_at') THEN
    ALTER TABLE "references" ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'references' AND column_name = 'deleted_by') THEN
    ALTER TABLE "references" ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- ステップ2: インデックス作成
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_references_deleted_at ON "references"(deleted_at) WHERE deleted_at IS NOT NULL;

-- ステップ3: 削除されたアイテム用のポリシーのみ追加
DO $$
BEGIN
  -- プロジェクト用の削除ポリシー
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own deleted projects' AND tablename = 'projects') THEN
    CREATE POLICY "Users can view their own deleted projects" ON projects
      FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update deleted projects they deleted' AND tablename = 'projects') THEN
    CREATE POLICY "Users can update deleted projects they deleted" ON projects
      FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;

  -- 参照用の削除ポリシー
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own deleted references' AND tablename = 'references') THEN
    CREATE POLICY "Users can view their own deleted references" ON "references"
      FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update deleted references they deleted' AND tablename = 'references') THEN
    CREATE POLICY "Users can update deleted references they deleted" ON "references"
      FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
  END IF;
END $$;

-- ステップ4: 関数作成
CREATE OR REPLACE FUNCTION cleanup_old_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM projects 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM "references" 
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION soft_delete_project_references()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE "references" 
    SET deleted_at = NEW.deleted_at, deleted_by = NEW.deleted_by
    WHERE project_id = NEW.id AND deleted_at IS NULL;
  END IF;
  
  IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    UPDATE "references" 
    SET deleted_at = NULL, deleted_by = NULL
    WHERE project_id = NEW.id AND deleted_by = OLD.deleted_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ステップ5: トリガー作成
DROP TRIGGER IF EXISTS trigger_soft_delete_project_references ON projects;
CREATE TRIGGER trigger_soft_delete_project_references
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_project_references();
