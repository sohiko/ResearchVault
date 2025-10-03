-- ゴミ箱システムの実装（安全版）
-- 段階的に実行可能

-- ステップ1: カラム追加
DO $$
BEGIN
  -- プロジェクトテーブルにカラム追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_at') THEN
    ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deleted_by') THEN
    ALTER TABLE projects ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
  END IF;
  
  -- 参照テーブルにカラム追加
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

-- ステップ3: 既存ポリシーの削除
DO $$
BEGIN
  -- プロジェクトポリシー削除
  DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
  DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
  DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
  DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
  
  -- 参照ポリシー削除
  DROP POLICY IF EXISTS "Users can view their own references" ON "references";
  DROP POLICY IF EXISTS "Users can insert their own references" ON "references";
  DROP POLICY IF EXISTS "Users can update their own references" ON "references";
  DROP POLICY IF EXISTS "Users can delete their own references" ON "references";
END $$;

-- ステップ4: 新しいポリシー作成（プロジェクト）
DO $$
BEGIN
  -- 既存ポリシーを削除してから作成
  DROP POLICY IF EXISTS "Users can view their own active projects" ON projects;
  CREATE POLICY "Users can view their own active projects" ON projects
    FOR SELECT USING (auth.uid() = owner_id AND deleted_at IS NULL);

  DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
  CREATE POLICY "Users can insert their own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
  CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (auth.uid() = owner_id);

  DROP POLICY IF EXISTS "Users can view their own deleted projects" ON projects;
  CREATE POLICY "Users can view their own deleted projects" ON projects
    FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

  DROP POLICY IF EXISTS "Users can update deleted projects they deleted" ON projects;
  CREATE POLICY "Users can update deleted projects they deleted" ON projects
    FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
END $$;

-- ステップ5: 新しいポリシー作成（参照）
DO $$
BEGIN
  -- 既存ポリシーを削除してから作成
  DROP POLICY IF EXISTS "Users can view their own active references" ON "references";
  CREATE POLICY "Users can view their own active references" ON "references"
    FOR SELECT USING (auth.uid() = saved_by AND deleted_at IS NULL);

  DROP POLICY IF EXISTS "Users can insert their own references" ON "references";
  CREATE POLICY "Users can insert their own references" ON "references"
    FOR INSERT WITH CHECK (auth.uid() = saved_by);

  DROP POLICY IF EXISTS "Users can update their own references" ON "references";
  CREATE POLICY "Users can update their own references" ON "references"
    FOR UPDATE USING (auth.uid() = saved_by);

  DROP POLICY IF EXISTS "Users can view their own deleted references" ON "references";
  CREATE POLICY "Users can view their own deleted references" ON "references"
    FOR SELECT USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);

  DROP POLICY IF EXISTS "Users can update deleted references they deleted" ON "references";
  CREATE POLICY "Users can update deleted references they deleted" ON "references"
    FOR UPDATE USING (auth.uid() = deleted_by AND deleted_at IS NOT NULL);
END $$;

-- ステップ6: 関数とトリガー作成
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

-- トリガー作成
DROP TRIGGER IF EXISTS trigger_soft_delete_project_references ON projects;
CREATE TRIGGER trigger_soft_delete_project_references
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_project_references();

-- ステップ7: ビュー作成
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
