# Database Migration 012: 候補テーブルのスキーマ修正

## 概要

`browsing_history_candidates`テーブルに必要なカラムを追加し、記録漏れ候補機能を完全に動作させます。

## 追加されるカラム

- `user_id`: ユーザーID（外部キー）
- `visited_at`: 訪問日時
- `visit_count`: 訪問回数
- `confidence_score`: 信頼度スコア（0.0-1.0）
- `suggested_reason`: 候補として提案する理由
- `is_academic`: 学術サイトフラグ
- `category`: カテゴリ
- `dismissed`: 却下フラグ
- `dismissed_at`: 却下日時
- `favicon`: ファビコンURL

## マイグレーション実行方法

### オプション1: psql コマンドを使用

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/012_fix_candidates_schema.sql
```

### オプション2: Supabase SQL エディタを使用

1. Supabase Dashboardにログイン
2. 左側のメニューから「SQL Editor」を選択
3. 「New query」をクリック
4. `supabase/migrations/012_fix_candidates_schema.sql`の内容をコピー&ペースト
5. 「Run」をクリック

## 動作確認

マイグレーション実行後、以下を確認してください：

```sql
-- テーブル構造を確認
\d browsing_history_candidates

-- RLSポリシーを確認
SELECT * FROM pg_policies WHERE tablename = 'browsing_history_candidates';

-- インデックスを確認
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'browsing_history_candidates';
```

## ロールバック方法

問題が発生した場合、以下のコマンドでロールバックできます：

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/ROLLBACK_012.sql
```

**注意**: ロールバックすると、追加されたカラムとそのデータがすべて削除されます。

## 関連ファイル

- **マイグレーションファイル**: `supabase/migrations/012_fix_candidates_schema.sql`
- **ロールバックファイル**: `supabase/migrations/ROLLBACK_012.sql`
- **拡張機能**: `extension/background/service-worker.js`
- **Web UI**: `web/src/pages/Candidates.jsx`

## 次のステップ

1. マイグレーションを実行
2. 拡張機能をリロード（Chrome拡張機能管理画面で）
3. Webアプリで記録漏れ候補ページを開く
4. 「履歴を分析」ボタンをクリック
5. 学術サイトが候補として表示されることを確認

