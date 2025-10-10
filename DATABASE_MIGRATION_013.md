# データベースマイグレーション 013

## 概要
`browsing_history_candidates`テーブルに重複防止のためのUNIQUE制約を追加します。

## 目的
- 同じユーザーが同じURLの候補を複数回保存することを防ぐ
- データベースの整合性を向上させる
- 重複データによるパフォーマンス低下を防ぐ

## 変更内容

### 1. 既存の重複データのクリーンアップ
同じuser_idとurlの組み合わせで複数の行がある場合、最新のもの（idが最大のもの）を残して他を削除します。

### 2. UNIQUE制約の追加
```sql
ALTER TABLE public.browsing_history_candidates
ADD CONSTRAINT browsing_history_candidates_user_url_unique 
UNIQUE (user_id, url);
```

### 3. インデックスの追加
```sql
CREATE INDEX IF NOT EXISTS idx_browsing_history_candidates_user_url 
  ON public.browsing_history_candidates(user_id, url);
```

## 適用方法

### Supabase Dashboard を使用する場合

1. Supabase Dashboard にアクセス
2. プロジェクトを選択
3. SQL Editor を開く
4. `/supabase/migrations/013_unique_candidates.sql` の内容をコピー＆ペースト
5. 実行

### Supabase CLI を使用する場合

```bash
# マイグレーションを適用
supabase db push

# または、特定のマイグレーションファイルを実行
supabase db reset  # 開発環境のみ
```

## 影響

### データへの影響
- 重複した候補レコードが削除されます（最新のものを残す）
- 既存のアプリケーション機能には影響ありません

### アプリケーションへの影響
- 拡張機能が同じURLを複数回保存しようとした場合、エラーが返されます
- アプリケーション側で重複エラーを適切にハンドリングするよう修正済み（409エラーをスキップ）

## ロールバック方法

制約を削除するには：

```sql
-- UNIQUE制約を削除
ALTER TABLE public.browsing_history_candidates
DROP CONSTRAINT IF EXISTS browsing_history_candidates_user_url_unique;

-- インデックスを削除
DROP INDEX IF EXISTS idx_browsing_history_candidates_user_url;
```

## 確認方法

```sql
-- 制約が正しく追加されたか確認
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'browsing_history_candidates';

-- 重複データが存在しないか確認
SELECT user_id, url, COUNT(*) 
FROM public.browsing_history_candidates 
GROUP BY user_id, url 
HAVING COUNT(*) > 1;
```

## 注意事項

- このマイグレーションは既存のデータを変更します
- 本番環境に適用する前に、必ずバックアップを取得してください
- 重複データが多い場合、マイグレーションに時間がかかる可能性があります

