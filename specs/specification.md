# ResearchVault 仕様書

## 1. プロジェクト概要

### 1.1 目的
ResearchVaultは、IB生を中心とした学生の研究活動を支援する参照管理システムです。Chrome拡張機能とWebダッシュボードで構成され、レポート作成時の参考文献管理を効率化します。

### 1.2 主な機能
- Webページの情報を瞬時に保存
- 選択テキストの記録と管理
- ページ内ブックマーク機能
- 引用形式の自動生成
- プロジェクト別の整理
- チーム共有機能
- 保存されていない論文と思われるサイト履歴の候補表示

### 1.3 対象ユーザー
- 主要ターゲット：広島叡智学園の生徒（IB課程）
- 二次ターゲット：一般の高校生・大学生

## 2. システム構成

### 2.1 技術スタック

#### Chrome拡張機能
- Manifest V3
- JavaScript (ES6+)
- Chrome Storage API
- HTML/CSS

#### Webダッシュボード
- フロントエンド：React.js 18+
- スタイリング：Tailwind CSS
- 状態管理：Context API
- ルーティング：React Router v6
- バックエンド：Supabase
- 認証：Supabase Auth

- データベース：PostgreSQL (Supabase)
- ストレージ：Supabase Storage

### 2.2 システムアーキテクチャ

    ユーザー
       ↓
    Chrome拡張機能
       ↓
    Chrome Storage (ローカル一時保存)
       ↓
    Supabase API
       ↓
    PostgreSQL Database
       ↑
    Webダッシュボード

## 3. 機能仕様

### 3.1 Chrome拡張機能

#### 3.1.1 基本機能

**ページ情報の保存**
- URL
- ページタイトル
- 保存日時
- ページのメタ情報（著者、公開日など）
- ファビコン

**選択テキストの保存**
- 選択したテキスト
- テキストの位置情報（XPath）
- 周辺のコンテキスト（前後50文字）
- ハイライトカラー（カテゴリ別）

**ページ内ブックマーク**
- 特定の要素へのアンカーリンク作成
- スクロール位置の記録
- 要素のスクリーンショット（オプション）

**ウェブページ**
- ウェブページにおける履歴候補の表示
- 保存情報のAPA方式変換
- 全ての情報の確認
- プロジェクトフォルダのアイコン、色設定など
- 細かな設定

**アカウント**
- メールアドレスとパスワード、もしくはSNS認証
- アカウント作成により、アカウント間のデータ連携が可能
- 他者とのデータ連携が可能になる
- アカウント削除機能、アカウント基本情報変更機能

#### 3.1.2 UI/UX

**ポップアップウィンドウ**
    ┌─────────────────────────┐
    │ ResearchVault           │
    │                         │
    │ 現在のページを保存         │
    │ [保存]                  │
    │                         │
    │ プロジェクト:             │
    │ [ドロップダウン▼]         │
    │                         │
    │ タグ:                   │
    │ [タグ入力]              │
    │                        │
    │ メモ:                   │
    │ [テキストエリア]          │
    │                         │
    │ [ダッシュボードを開く]     │
    └─────────────────────────┘

- この際、プロジェクトは最も最近に選択したプロジェクトをデフォルト値として設定する。
- タグ設定は任意。メモも任意。
- 拡張機能ボタンをページを開いた上で押すことで作動する。
- コンテキストメニューから保存を選んでも作動する。

**コンテキストメニュー**
- 右クリックメニューに以下を追加
  - "ResearchVaultに保存"
  - "選択テキストを保存"
  - "ページ内ブックマークを作成"
- プロジェクトに登録されているページであれば、プロジェクトと紐付けて登録する（選択テキスト・ブックマークの場合）
- プロジェクトに一個も登録されていないページであれば、画面右上にプロジェクト登録を促すポップアップウィンドウを表示し、プロジェクト種類を選択できるようにする。（選択テキスト・ブックマークの場合）
- プロジェクトが選択されていない場合、プロジェクトIDは空欄として、未分類フォルダに分類される。（選択テキスト・ブックマークの場合）
- その後ポップアップによってプロジェクトが選択された場合は未分類フォルダからそのプロジェクトフォルダへと移行する。（選択テキスト・ブックマークの場合）
- ポップアップには固有IDが紐づけられており、その固有IDでプロジェクトフォルダへと移動させる。（選択テキスト・ブックマークの場合）

**ショートカットキー**
- Ctrl+Shift+S: クイック保存
- Ctrl+Shift+B: ブックマーク作成

#### 3.1.3 データ構造

    Reference {
        id: string (UUID),
        url: string,
        title: string,
        favicon: string,
        savedAt: timestamp,
        projectId: string,
        tags: string[],
        memo: string,
        userId: string,
        metadata: {
            author: string,
            publishedDate: date,
            description: string
        }
    }

    SelectedText {
        id: string (UUID),
        referenceId: string,
        text: string,
        xpath: string,
        context: {
            before: string,
            after: string
        },
        projectId: string,
        highlightColor: string,
        userId: string,
        createdAt: timestamp
    }

    Bookmark {
        id: string (UUID),
        referenceId: string,
        elementXpath: string,
        scrollPosition: number,
        label: string,
        screenshot: string (base64),
        projectId: string,
        userId: string,
        createdAt: timestamp
    }

### 3.2 Webダッシュボード

#### 3.2.1 ページ構成

**ダッシュボード（ホーム）**
- 最近保存した参照一覧
- プロジェクト別サマリー
- クイックアクション
- アカウント連携機能
- ブックマーク一覧

**参照一覧ページ**
- フィルター機能
  - プロジェクト別
  - タグ別
  - 日付範囲
  - 検索（全文検索）
- ソート機能
  - 保存日時
  - タイトル
  - URL
- 一括操作
  - 複数選択
  - 一括削除
  - 一括タグ付け

＊各プロジェクトごとにページを用意し、プロジェクトの引用一覧を表示する。引用生成はプロジェクトごとに行えるようにするほか、それぞれ一個ずつでも作成してコピーできるようにする。引用スタイルは引用生成設定ページに従う。一個ずつのコピーの場合、一覧の各要素をホバーしたときに各要素の下にコピーボタンが表示され、押すことでできる。プロジェクト全体の引用はプロジェクト一覧の上部に専用ボタンを設置する。

**参照詳細ページ**
- 基本情報表示
- 保存したテキスト一覧
- ブックマーク一覧
- 引用生成機能
- 編集・削除機能

＊参照一覧からページタイトルをクリックすることでこのページ（モーダル）が表示される。

**プロジェクト管理ページ**
- プロジェクト作成・編集
- メンバー招待（共有機能）
- プロジェクト別統計

**引用生成設定ページ**
- 引用スタイル選択（APA, MLA, Chicago等）
- プレビュー機能
- このページは引用設定ができるだけで、引用生成は各プロジェクトごとの引用一覧ページで行う。

**設定ページ**
- プロジェクトのフォルダアイコン設定、色設定
- ダークモード、ライトモード選択（そのため、ダークモード、ライドモードどちらにも対応できる作りが必要）
- ダッシュボードの表示順番設定

**アカウントページ**
- アカウント情報変更
- アカウント削除
- アカウント連携
- アカウント連携解除

#### 3.2.2 UI コンポーネント

**ヘッダー**
    ┌─────────────────────────────────────────────┐
    │ ResearchVault  [検索バー]  [設定] [アカウント] │
    └─────────────────────────────────────────────┘

＊アイコンはfaviconフォルダにある。デザインに使用する。

**サイドバー**
    ├─ ダッシュボード
    ├─ 参照一覧
    ├─ プロジェクト
    │  ├─ Extended Essay
    │  ├─ TOK Essay
    │  └─ + 新規プロジェクト
    ├─ 記録漏れ候補
    ├─ ゴミ箱
    └─ 機能リクエスト

**参照カード**
    ┌─────────────────────────┐
    │ [ファビコン] タイトル    │
    │ URL                     │
    │ 保存日時 | タグ         │
    │ メモプレビュー...       │
    │ [詳細] [引用] [削除]    │
    └─────────────────────────┘

#### 3.2.3 レスポンシブデザイン
- デスクトップ（1200px以上）：フルレイアウト
- タブレット（768px-1199px）：サイドバー折りたたみ
- モバイル（767px以下）：モバイル最適化UI

### 3.3 共有・コラボレーション機能

#### 3.3.1 プロジェクト共有
- 招待リンク生成
- メールアドレスによる招待
- 権限設定
  - 閲覧のみ
  - 編集可能
  - 管理者

#### 3.3.2 リアルタイム同期
- 共有プロジェクトの変更をリアルタイム反映
- 衝突回避機構

### 3.4 引用生成機能

#### 3.4.1 対応フォーマット
- APA 7th Edition
- APA 6th Edition
- MLA 9th Edition
- Chicago 17th Edition
- Harvard
- IEEE

#### 3.4.2 自動抽出情報
- 著者名
- 公開日
- アクセス日
- ページタイトル
- ウェブサイト名

#### 3.4.3 出力形式
- テキスト形式
- Word形式（.docx）
- BibTeX形式
- RIS形式

## 4. データベース設計

### 4.1 テーブル構造

**users テーブル**
    id: UUID (PK)
    email: VARCHAR(255) UNIQUE NOT NULL
    name: VARCHAR(100)
    created_at: TIMESTAMP
    updated_at: TIMESTAMP

**projects テーブル**
    id: UUID (PK)
    name: VARCHAR(200) NOT NULL
    description: TEXT
    owner_id: UUID (FK → users.id)
    created_at: TIMESTAMP
    updated_at: TIMESTAMP

**project_members テーブル**
    project_id: UUID (FK → projects.id)
    user_id: UUID (FK → users.id)
    role: ENUM('viewer', 'editor', 'admin')
    joined_at: TIMESTAMP
    PRIMARY KEY (project_id, user_id)

**references テーブル**
    id: UUID (PK)
    project_id: UUID (FK → projects.id)
    url: TEXT NOT NULL
    title: VARCHAR(500)
    favicon: TEXT
    saved_at: TIMESTAMP
    saved_by: UUID (FK → users.id)
    memo: TEXT
    metadata: JSONB
    created_at: TIMESTAMP
    updated_at: TIMESTAMP

**tags テーブル**
    id: UUID (PK)
    name: VARCHAR(50) UNIQUE NOT NULL
    color: VARCHAR(7)

**reference_tags テーブル**
    reference_id: UUID (FK → references.id)
    tag_id: UUID (FK → tags.id)
    PRIMARY KEY (reference_id, tag_id)

**selected_texts テーブル**
    id: UUID (PK)
    reference_id: UUID (FK → references.id)
    text: TEXT NOT NULL
    xpath: TEXT
    context_before: VARCHAR(100)
    context_after: VARCHAR(100)
    highlight_color: VARCHAR(7)
    created_by: UUID (FK → users.id)
    created_at: TIMESTAMP

**bookmarks テーブル**
    id: UUID (PK)
    reference_id: UUID (FK → references.id)
    element_xpath: TEXT
    scroll_position: INTEGER
    label: VARCHAR(200)
    screenshot: TEXT
    created_by: UUID (FK → users.id)
    created_at: TIMESTAMP

### 4.2 インデックス
- references.project_id
- references.saved_by
- references.saved_at
- selected_texts.reference_id
- bookmarks.reference_id

## 5. API仕様

### 5.1 認証
すべてのAPIエンドポイントはJWT認証を使用

### 5.2 主要エンドポイント

**参照関連**
    GET    /api/references
    GET    /api/references/:id
    POST   /api/references
    PUT    /api/references/:id
    DELETE /api/references/:id

**プロジェクト関連**
    GET    /api/projects
    GET    /api/projects/:id
    POST   /api/projects
    PUT    /api/projects/:id
    DELETE /api/projects/:id
    POST   /api/projects/:id/invite

**選択テキスト関連**
    GET    /api/references/:id/texts
    POST   /api/references/:id/texts
    DELETE /api/texts/:id

**引用生成**
    POST   /api/citations/generate

### 5.3 レスポンス形式

成功時:
    {
        "success": true,
        "data": { ... }
    }

エラー時:
    {
        "success": false,
        "error": {
            "code": "ERROR_CODE",
            "message": "エラーメッセージ"
        }
    }

## 6. セキュリティ仕様

### 6.1 認証・認可
- Supabase Authによる認証
- Row Level Security (RLS) によるデータアクセス制御
- プロジェクトメンバーのみアクセス可能

### 6.2 データ保護
- HTTPS通信の強制
- XSS対策（React標準機能）
- CSRF対策（SameSite Cookie）
- SQLインジェクション対策（パラメータバインディング）

### 6.3 拡張機能のセキュリティ
- Content Security Policy の設定
- 最小権限の原則
- 外部スクリプトの制限

## 7. 非機能要件

### 7.1 パフォーマンス
- ページ保存: 3秒以内
- ダッシュボード表示: 2秒以内
- 検索レスポンス: 1秒以内

### 7.2 可用性
- Supabaseの標準SLAに準拠
- オフライン時は拡張機能でローカル保存

### 7.3 スケーラビリティ
- ユーザー数: 1,000人まで対応
- 参照数: ユーザーあたり10,000件まで

### 7.4 互換性
- Chrome: バージョン100以上
- Edge: バージョン100以上
- 画面解像度: 1280x720以上推奨

## 8. 開発スケジュール

### Phase 1: 基本機能（4週間）
- Week 1: 環境構築、DB設計
- Week 2: 拡張機能の基本機能
- Week 3: Webダッシュボードの基本UI
- Week 4: API連携、基本機能テスト

### Phase 2: 応用機能（3週間）
- Week 5: 引用生成機能
- Week 6: 共有・コラボレーション機能
- Week 7: UI/UX改善、バグ修正

### Phase 3: テスト・リリース（3週間）
- Week 8: ユーザーテスト（後輩5名）
- Week 9: フィードバック反映
- Week 10: ドキュメント作成、リリース準備

## 9. テスト計画

### 9.1 単体テスト
- Jest によるJavaScriptコードのテスト
- React Testing Library によるコンポーネントテスト

### 9.2 統合テスト
- API通信のテスト
- 拡張機能とWebダッシュボードの連携テスト

### 9.3 ユーザビリティテスト
- 5名の後輩による実使用テスト
- タスク完了率の測定
- System Usability Scale (SUS) による評価

## 10. 運用・保守

### 10.1 モニタリング
- Supabase Dashboard でのAPI使用状況監視
- エラーログの収集と分析

### 10.2 バックアップ
- Supabaseの自動バックアップ機能を利用
- 週次でのデータエクスポート

### 10.3 サポート体制
- GitHubでのIssue管理
- 月1回のユーザーフィードバック会
- 後輩への引き継ぎドキュメント作成

## 11. 今後の拡張予定

### 11.1 追加機能案
- PDFファイルの保存・注釈機能
- 音声メモ機能
- AIによる要約生成
- モバイルアプリ版

### 11.2 他校展開
- オープンソース化の検討
- 他のIB校との連携
- 多言語対応

## 12. ライセンス

本プロジェクトはMITライセンスで公開予定
