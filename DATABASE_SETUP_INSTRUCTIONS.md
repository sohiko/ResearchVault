# データベース設定手順

ResearchVaultの記録漏れ候補と教科分類機能を使用するには、3つのマイグレーションが必要です。

## 前提条件

- Supabaseプロジェクトが作成されていること
- PostgreSQLクライアント（`psql`）がインストールされていること
- またはSupabase SQL Editorにアクセスできること

## 方法1: psqlコマンドで実行（推奨）

### ステップ1: データベース接続情報を取得

1. Supabaseダッシュボードにログイン: https://app.supabase.com
2. プロジェクトを選択
3. 左サイドバーから「Project Settings」→「Database」
4. 「Connection string」タブで接続情報を確認

### ステップ2: マイグレーションを順番に実行

```bash
# プロジェクトのディレクトリに移動
cd /Users/s26034/Desktop/Code/ResearchVault

# マイグレーション010を実行（基本テーブル作成）
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f supabase/migrations/010_candidates_and_subjects.sql

# マイグレーション011を実行（教科分類カラム追加）
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f supabase/migrations/011_candidates_subject_classification.sql

# マイグレーション012を実行（必須カラム追加）
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" -f supabase/migrations/012_fix_candidates_schema.sql
```

**注意**: 
- `[YOUR-PASSWORD]`と`[YOUR-HOST]`を実際の値に置き換えてください
- パスワードに特殊文字が含まれる場合はエスケープが必要です
- 010→011→012の順番で実行してください（順番が重要）

## 方法2: Supabase SQL Editorで実行

### ステップ1: マイグレーションファイルを開く

```bash
# マイグレーション010の内容を表示
cat supabase/migrations/010_candidates_and_subjects.sql

# マイグレーション011の内容を表示
cat supabase/migrations/011_candidates_subject_classification.sql
```

### ステップ2: 順番に実行

1. Supabaseダッシュボードで左サイドバーから「SQL Editor」を選択
2. 「New query」をクリック
3. **まず010のSQLをコピーして貼り付け**、「Run」をクリック
4. 「New query」をクリック
5. **次に011のSQLをコピーして貼り付け**、「Run」をクリック
6. 「New query」をクリック
7. **最後に012のSQLをコピーして貼り付け**、「Run」をクリック

## 実行される変更内容

### マイグレーション010: 基本テーブル作成

1. **browsing_history_candidates**
   - 記録漏れ候補として検出されたブラウジング履歴を保存
   - 基本カラム: url, title, created_at

### マイグレーション011: 教科分類機能追加

1. **browsing_history_candidatesに追加されるカラム**
   - `subject`: 教科（国語、数学、歴史、物理、生物、化学、地理、英語、音楽、美術、技術、家庭科、その他）
   - `subject_confidence`: 分類信頼度（0.0-1.0）
   - `ai_classified`: AI分類フラグ
   - `classification_result`: AI分類詳細（JSON）
   - `classified_at`: 分類実行日時

2. **削除されるテーブル**（設計変更のため）
   - `subject_tags`: 候補に直接カラムを追加する方式に変更
   - `ai_classification_cache`: 候補テーブルに統合

### マイグレーション012: 必須カラム追加【重要】

1. **browsing_history_candidatesに追加される必須カラム**
   - `user_id`: ユーザーID（外部キー、NOT NULL）
   - `visited_at`: 訪問日時（NOT NULL）
   - `visit_count`: 訪問回数
   - `confidence_score`: 信頼度スコア（0.0-1.0）
   - `suggested_reason`: 候補として提案する理由
   - `is_academic`: 学術サイトフラグ
   - `category`: カテゴリ
   - `dismissed`: 却下フラグ
   - `dismissed_at`: 却下日時
   - `favicon`: ファビコンURL

2. **追加されるインデックス**
   - `idx_candidates_user_id`: ユーザーID検索用
   - `idx_candidates_dismissed`: 却下状態検索用
   - `idx_candidates_visited_at`: 訪問日時ソート用
   - `idx_candidates_subject`: 教科フィルター用

3. **追加されるRLSポリシー**
   - ユーザーは自分の候補のみ閲覧・編集・削除可能

### インデックス

パフォーマンス向上のため、以下のインデックスが作成されます：
- user_id, dismissed, visited_at
- reference_id, subject
- URL検索用インデックス

### RLS (Row Level Security) ポリシー

各テーブルに適切な権限設定が適用されます：
- ユーザーは自分のデータのみ閲覧・編集可能
- プロジェクトメンバーは関連する参照の教科タグを閲覧可能

## 確認方法

### マイグレーション成功の確認

Supabase SQL Editorで以下を実行：

```sql
-- テーブルが作成されたか確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'browsing_history_candidates';

-- カラムが追加されたか確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'browsing_history_candidates'
ORDER BY ordinal_position;
```

正常に実行されると、テーブル名とすべてのカラムが表示されます。
特に以下のカラムが存在することを確認してください：
- user_id（NOT NULL）
- visited_at（NOT NULL）
- confidence_score
- suggested_reason
- is_academic
- dismissed
- subject
- ai_classified

### アプリケーションでの確認

1. **拡張機能をリロード**
   - `chrome://extensions/` を開く
   - ResearchVault拡張機能の「再読み込み」をクリック

2. **学術サイトを訪問**
   - 例: https://scholar.google.com
   - 例: https://arxiv.org
   - 例: https://pubmed.ncbi.nlm.nih.gov
   - 例: https://www.jstage.jst.go.jp

3. **Webアプリで確認**
   - Webアプリにログイン
   - 「記録漏れ候補」ページを開く
   - 「履歴を分析」ボタンをクリック
   - 候補が表示されることを確認
   - 「未分類の候補を教科分類」ボタンが表示されることを確認
   - 教科フィルターが表示されることを確認
   - 候補を読み込んで分類機能が動作することを確認

## トラブルシューティング

### エラー: "relation already exists"

すでにテーブルが存在しています。問題ありません。

### エラー: "permission denied"

データベースの権限を確認してください。Supabaseの管理者権限が必要です。

### エラー: "syntax error"

SQLファイルの内容をコピーする際に文字化けが発生している可能性があります。
ファイルをテキストエディタで開き、UTF-8エンコーディングで保存してください。

## ロールバック（元に戻す場合）

### マイグレーション012のみをロールバック

```bash
# マイグレーション012のみを元に戻す
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/ROLLBACK_012.sql
```

### すべてのマイグレーションをロールバック

```bash
# すべてのマイグレーション（010、011、012）を元に戻す
# まず012をロールバック
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/ROLLBACK_012.sql

# 次に010と011をロールバック
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/ROLLBACK_010_and_011.sql
```

**または** Supabase SQL Editorで：

```bash
# マイグレーション012のロールバック内容を表示
cat supabase/migrations/ROLLBACK_012.sql

# すべてのロールバック内容を表示
cat supabase/migrations/ROLLBACK_010_and_011.sql
```

上記の内容をSQL Editorで実行（順番に012→010_and_011）

**警告**: 
- ロールバックすると関連するカラムやテーブルとすべてのデータが削除されます
- 記録漏れ候補のデータは完全に失われます
- この操作は取り消せません
- 012をロールバックする場合、011と010は残ります
- すべてをロールバックする場合は、012→010_and_011の順で実行してください

## 次のステップ

マイグレーション完了後：

1. **Gemini APIの設定**: `GEMINI_SETUP.md`を参照してAPIキーを取得・設定
2. **拡張機能のリロード**: Chrome拡張機能を再読み込み
3. **動作確認**: 
   - Webアプリで「記録漏れ候補」ページを開く
   - 「未分類の候補を教科分類」ボタンをクリック
   - AI分類が正常に動作することを確認

## サポート

問題が発生した場合は、以下の情報を添えてお問い合わせください：
- エラーメッセージ全文
- 実行したSQLコマンド
- Supabaseのバージョン情報

