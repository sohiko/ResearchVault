-- 015_references_enhanced.sql
-- 参照情報の大幅拡張
-- 書籍、論文、雑誌論文、レポート、ウェブサイトなど多様な文献に対応

-- referencesテーブルの拡張
ALTER TABLE references
ADD COLUMN IF NOT EXISTS reference_type TEXT CHECK (reference_type IN ('website', 'article', 'journal', 'book', 'report')),
ADD COLUMN IF NOT EXISTS authors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS publisher TEXT,
ADD COLUMN IF NOT EXISTS pages TEXT,
ADD COLUMN IF NOT EXISTS isbn TEXT,
ADD COLUMN IF NOT EXISTS doi TEXT,
ADD COLUMN IF NOT EXISTS online_link TEXT,
ADD COLUMN IF NOT EXISTS journal_name TEXT,
ADD COLUMN IF NOT EXISTS volume TEXT,
ADD COLUMN IF NOT EXISTS issue TEXT,
ADD COLUMN IF NOT EXISTS edition TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ja';

-- author カラムが既に存在する場合は削除（authorsに統合）
ALTER TABLE references DROP COLUMN IF EXISTS author;

-- published_date と accessed_date を DATE 型に変更
-- 既存データがある場合は安全に変換
DO $$
BEGIN
  -- published_date の型チェックと変換
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'references' 
    AND column_name = 'published_date' 
    AND data_type != 'date'
  ) THEN
    ALTER TABLE references 
    ALTER COLUMN published_date TYPE DATE 
    USING CASE 
      WHEN published_date IS NULL THEN NULL
      WHEN published_date ~ '^\d{4}-\d{2}-\d{2}' THEN published_date::date
      ELSE NULL
    END;
  END IF;

  -- accessed_date の型チェックと変換
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'references' 
    AND column_name = 'accessed_date' 
    AND data_type != 'date'
  ) THEN
    ALTER TABLE references 
    ALTER COLUMN accessed_date TYPE DATE 
    USING CASE 
      WHEN accessed_date IS NULL THEN NULL
      WHEN accessed_date ~ '^\d{4}-\d{2}-\d{2}' THEN accessed_date::date
      ELSE NULL
    END;
  END IF;
END $$;

-- インデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_references_reference_type ON references(reference_type);
CREATE INDEX IF NOT EXISTS idx_references_isbn ON references(isbn) WHERE isbn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_references_doi ON references(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_references_language ON references(language);
CREATE INDEX IF NOT EXISTS idx_references_publisher ON references(publisher) WHERE publisher IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_references_journal_name ON references(journal_name) WHERE journal_name IS NOT NULL;

-- コメント追加（データベースドキュメント）
COMMENT ON COLUMN references.reference_type IS '引用種類: website, article, journal, book, report';
COMMENT ON COLUMN references.authors IS '著者情報の配列 [{"name": "著者名", "order": 1}]';
COMMENT ON COLUMN references.publisher IS '出版社・発行者';
COMMENT ON COLUMN references.pages IS 'ページ範囲（例: 123-145 または 256pp）';
COMMENT ON COLUMN references.isbn IS 'ISBN番号（ハイフンあり・なし両対応）';
COMMENT ON COLUMN references.doi IS 'DOI（Digital Object Identifier）';
COMMENT ON COLUMN references.online_link IS 'オンライン版のURL（書籍のオンライン版など）';
COMMENT ON COLUMN references.journal_name IS '論文誌・雑誌名';
COMMENT ON COLUMN references.volume IS '巻';
COMMENT ON COLUMN references.issue IS '号';
COMMENT ON COLUMN references.edition IS '版（書籍の第何版か）';
COMMENT ON COLUMN references.is_online IS 'オンライン資料かどうか';
COMMENT ON COLUMN references.language IS '言語コード（ja, en, fr等のISO 639-1）';

-- 既存の metadata から新しいカラムへデータを移行（可能な範囲で）
UPDATE references
SET 
  authors = CASE 
    WHEN metadata->>'author' IS NOT NULL THEN 
      jsonb_build_array(jsonb_build_object('name', metadata->>'author', 'order', 1))
    ELSE authors
  END,
  publisher = COALESCE(publisher, metadata->>'publisher'),
  published_date = COALESCE(published_date, 
    CASE 
      WHEN metadata->>'publishedDate' ~ '^\d{4}-\d{2}-\d{2}' 
      THEN (metadata->>'publishedDate')::date
      ELSE NULL
    END
  ),
  is_online = COALESCE(is_online, 
    CASE 
      WHEN url LIKE '%pdf' THEN true
      WHEN url LIKE '%doi.org%' THEN true
      ELSE false
    END
  )
WHERE metadata IS NOT NULL;

