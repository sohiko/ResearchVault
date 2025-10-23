-- 016_oauth_and_pdf_positions.sql
-- PDF内のテキスト位置情報を保存するカラム追加

-- PDF内のテキスト位置情報を保存
ALTER TABLE selected_texts
ADD COLUMN IF NOT EXISTS pdf_page INTEGER,
ADD COLUMN IF NOT EXISTS pdf_position JSONB;

COMMENT ON COLUMN selected_texts.pdf_page IS 'PDFのページ番号';
COMMENT ON COLUMN selected_texts.pdf_position IS 'PDF内の座標 {x, y, width, height}';

-- インデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_selected_texts_pdf_page ON selected_texts(pdf_page) WHERE pdf_page IS NOT NULL;

