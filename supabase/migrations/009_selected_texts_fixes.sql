-- selected_textsテーブルの調整（既存の場合はスキップされる）

-- reference_idのNULL許可を確認（既存の場合は問題なし）
ALTER TABLE selected_texts ALTER COLUMN reference_id DROP NOT NULL;

-- project_idのインデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_selected_texts_project_id ON selected_texts(project_id);

-- created_byのインデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_selected_texts_created_by ON selected_texts(created_by);

-- created_atのインデックス追加（並び替えのパフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_selected_texts_created_at ON selected_texts(created_at DESC);

-- reference_idのインデックス追加
CREATE INDEX IF NOT EXISTS idx_selected_texts_reference_id ON selected_texts(reference_id);

