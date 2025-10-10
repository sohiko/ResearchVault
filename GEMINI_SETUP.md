# Gemini API 設定ガイド

ResearchVaultの教科分類機能には、Google Gemini APIが必要です。

## 1. Gemini APIキーの取得

### ステップ1: Google AI Studioにアクセス
1. https://aistudio.google.com/app/apikey にアクセス
2. Googleアカウントでログイン

### ステップ2: APIキーを作成
1. 「Get API key」または「APIキーを取得」をクリック
2. 「Create API key」を選択
3. 既存のGoogle Cloudプロジェクトを選択するか、新規作成
4. APIキーが生成されます（例: `AIzaSy...`で始まる文字列）

### ステップ3: APIキーをコピー
⚠️ **重要**: APIキーは一度しか表示されないので、必ずコピーして安全な場所に保存してください。

## 2. Supabaseへの設定

### 方法A: Supabase Secrets（推奨）

1. Supabaseダッシュボードにログイン: https://app.supabase.com
2. プロジェクトを選択
3. 左サイドバーから「Project Settings」→「Secrets」
4. 「Add new secret」をクリック
5. 以下を入力:
   - Name: `GEMINI_API_KEY`
   - Value: 取得したAPIキー（`AIzaSy...`）
6. 「Save」をクリック

### 方法B: 環境変数（ローカル開発用）

プロジェクトルートに `.env.local` ファイルを作成:

```bash
# .env.local
VITE_GEMINI_API_KEY=AIzaSy...（あなたのAPIキー）
```

⚠️ **セキュリティ注意**: 
- `.env.local` は `.gitignore` に含まれていることを確認
- 絶対にGitHubなどにコミットしないこと

## 3. 使用モデルとレート制限

### 使用モデル
- **gemini-1.5-flash**: 高速・低コスト・無料枠が大きい
- 精度と速度のバランスが良く、教科分類には十分

### 無料枠（2024年10月時点）
- リクエスト: 15 RPM（1分あたり15リクエスト）
- トークン: 100万トークン/月
- 十分な無料枠があり、通常の使用では課金されません

### レート制限対策
- バッチサイズ: 3件ずつ処理
- バッチ間で1秒待機
- キャッシュ機能で重複APIコールを防止

## 4. 動作確認

### Webアプリでの確認
1. Webアプリにログイン
2. 「参照」ページで参照を選択
3. 「教科分類」ボタンをクリック
4. 分類が開始されます

### APIキーの検証
ブラウザの開発者コンソール（F12）で以下を実行:

```javascript
import GeminiClient from './lib/geminiClient.js'
const client = new GeminiClient('YOUR_API_KEY')
await client.validateApiKey()
```

成功すれば `{ valid: true }` が返ります。

## 5. トラブルシューティング

### エラー: "API key not found"
→ `.env.local` ファイルまたはSupabase Secretsを確認

### エラー: "Rate limit exceeded"
→ 分類する参照数を減らすか、時間を置いて再実行

### エラー: "Invalid API key"
→ APIキーが正しいか確認（スペースや改行が含まれていないか）

### 分類結果が「その他」ばかり
→ 正常です。分類できないページはフォールバック分類されます。

## 6. コスト管理

### 無料で使い続けるためのヒント
1. 必要な参照だけを分類（不要なページは除外）
2. キャッシュ機能を活用（同じページは再分類しない）
3. Google AI Studioで使用量を定期的に確認

### 使用量の確認
https://aistudio.google.com/app/prompts?pli=1
→ 右上のアイコン → Usage を確認

## 7. セキュリティベストプラクティス

✅ **推奨**:
- Supabase Secretsに保存
- 環境変数は `.gitignore` に追加
- APIキーを定期的にローテーション

❌ **禁止**:
- フロントエンドのコードに直接記述
- GitHubなどの公開リポジトリにコミット
- 他人と共有

## 参考リンク

- Google AI Studio: https://aistudio.google.com
- Gemini API ドキュメント: https://ai.google.dev/docs
- 料金情報: https://ai.google.dev/pricing

