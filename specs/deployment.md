# ResearchVault インフラストラクチャ・デプロイメント仕様書

## 1. ホスティング構成

### 1.1 使用サービス
- **バックエンド**: Supabase (BaaS)
- **フロントエンド**: Vercel (静的サイトホスティング)
- **拡張機能**: Chrome Web Store（将来）/ 開発者モード（当面）
- **ソースコード**: GitHub

### 1.2 コスト
- Supabase: 無料プラン（月間アクティブユーザー50,000人まで）
- Vercel: 無料プラン（個人利用）
- GitHub: 無料（パブリックリポジトリ）
- 合計: **0円/月**

## 2. ディレクトリ構造

    research-vault/
    ├── extension/                 # Chrome拡張機能
    │   ├── manifest.json         # 拡張機能マニフェスト
    │   ├── popup/                # ポップアップUI
    │   │   ├── popup.html
    │   │   ├── popup.js
    │   │   └── popup.css
    │   ├── background/           # バックグラウンドスクリプト
    │   │   └── service-worker.js
    │   ├── content/              # コンテンツスクリプト
    │   │   └── content.js
    │   ├── icons/                # アイコンファイル
    │   │   ├── icon16.png
    │   │   ├── icon48.png
    │   │   └── icon128.png
    │   └── lib/                  # 共通ライブラリ
    │       ├── api.js
    │       └── storage.js
    │
    ├── web/                      # Webダッシュボード
    │   ├── public/               # 静的ファイル
    │   ├── src/
    │   │   ├── components/       # Reactコンポーネント
    │   │   ├── pages/           # ページコンポーネント
    │   │   ├── hooks/           # カスタムフック
    │   │   ├── utils/           # ユーティリティ関数
    │   │   ├── styles/          # スタイルファイル
    │   │   ├── lib/             # Supabaseクライアント設定
    │   │   │   └── supabase.js
    │   │   ├── App.js
    │   │   └── index.js
    │   ├── .env.local            # 環境変数（ローカル）
    │   ├── .env.example          # 環境変数サンプル
    │   ├── package.json
    │   ├── vercel.json           # Vercel設定
    │   └── tailwind.config.js
    │
    ├── supabase/                 # Supabase設定
    │   ├── migrations/           # データベースマイグレーション
    │   │   └── 001_initial_schema.sql
    │   ├── functions/            # Edge Functions（必要に応じて）
    │   └── seed.sql              # 初期データ
    │
    ├── docs/                     # ドキュメント
    │   ├── setup.md              # セットアップガイド
    │   ├── api.md                # API仕様書
    │   └── user-manual.md       # ユーザーマニュアル
    │
    ├── scripts/                  # ユーティリティスクリプト
    │   ├── build-extension.sh    # 拡張機能ビルド
    │   └── deploy.sh             # デプロイスクリプト
    │
    ├── .github/                  # GitHub Actions
    │   └── workflows/
    │       ├── test.yml          # テスト自動化
    │       └── deploy.yml        # デプロイ自動化
    │
    ├── .gitignore
    ├── README.md
    └── LICENSE

## 3. Supabase設定

### 3.1 プロジェクト作成
1. https://app.supabase.com でアカウント作成
2. 新規プロジェクト作成
   - プロジェクト名: research-vault
   - データベースパスワード: 強固なパスワードを設定
   - リージョン: Northeast Asia (Tokyo)

### 3.2 環境変数
Supabaseダッシュボードから取得:
    NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJS...
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJS...

### 3.3 データベース初期設定

    -- supabase/migrations/001_initial_schema.sql
    
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Users table (Supabase Authと連携)
    CREATE TABLE public.profiles (
        id UUID REFERENCES auth.users ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        PRIMARY KEY (id)
    );
    
    -- Projects table
    CREATE TABLE public.projects (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
    
    -- 以下、他のテーブル定義...
    
    -- Row Level Security
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    
    -- Policies
    CREATE POLICY "Users can view own profile" ON public.profiles
        FOR SELECT USING (auth.uid() = id);
    
    CREATE POLICY "Users can update own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = id);

### 3.4 認証設定
1. Supabaseダッシュボード → Authentication → Providers
2. Email認証を有効化
3. サイトURL設定: https://research-vault.vercel.app
4. リダイレクトURL設定

## 4. Vercel設定

### 4.1 デプロイ設定

    # vercel.json
    {
        "buildCommand": "npm run build",
        "outputDirectory": "build",
        "framework": "create-react-app",
        "env": {
            "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
        },
        "headers": [
            {
                "source": "/api/(.*)",
                "headers": [
                    { "key": "Access-Control-Allow-Origin", "value": "*" }
                ]
            }
        ]
    }

### 4.2 環境変数設定
1. Vercelダッシュボード → Settings → Environment Variables
2. 以下を追加:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY

### 4.3 カスタムドメイン（オプション）
- research-vault.vercel.app（デフォルト）
- 独自ドメインも設定可能

## 5. 拡張機能の設定

### 5.1 manifest.json

    {
        "manifest_version": 3,
        "name": "ResearchVault",
        "version": "1.0.0",
        "description": "研究資料を効率的に管理する拡張機能",
        "permissions": [
            "activeTab",
            "storage",
            "contextMenus"
        ],
        "host_permissions": [
            "https://research-vault.vercel.app/*"
        ],
        "background": {
            "service_worker": "background/service-worker.js"
        },
        "action": {
            "default_popup": "popup/popup.html",
            "default_icon": {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        },
        "content_scripts": [
            {
                "matches": ["<all_urls>"],
                "js": ["content/content.js"],
                "run_at": "document_idle"
            }
        ],
        "externally_connectable": {
            "matches": ["https://research-vault.vercel.app/*"]
        }
    }

### 5.2 API通信設定

    // extension/lib/api.js
    
    const API_BASE_URL = 'https://research-vault.vercel.app/api';
    // 開発時は 'http://localhost:3000/api'
    
    class API {
        constructor() {
            this.token = null;
        }
        
        async authenticate() {
            // Chrome storage から認証トークンを取得
            const { authToken } = await chrome.storage.sync.get('authToken');
            this.token = authToken;
        }
        
        async saveReference(data) {
            const response = await fetch(`${API_BASE_URL}/references`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(data)
            });
            return response.json();
        }
    }

## 6. 開発環境セットアップ

### 6.1 必要なツール
- Node.js 18+
- npm or yarn
- Git
- Chrome ブラウザ

### 6.2 初回セットアップ手順

    # リポジトリのクローン
    git clone https://github.com/yourusername/research-vault.git
    cd research-vault
    
    # Webダッシュボードのセットアップ
    cd web
    npm install
    cp .env.example .env.local
    # .env.localにSupabaseの認証情報を記入
    
    # 開発サーバー起動
    npm run dev
    
    # 別ターミナルで拡張機能のビルド
    cd ../extension
    npm install
    npm run build

### 6.3 拡張機能の読み込み
1. Chrome → 拡張機能管理 → デベロッパーモード ON
2. 「パッケージ化されていない拡張機能を読み込む」
3. `extension`フォルダを選択

## 7. デプロイプロセス

### 7.1 自動デプロイ（GitHub Actions）

    # .github/workflows/deploy.yml
    
    name: Deploy to Vercel
    
    on:
        push:
            branches: [main]
    
    jobs:
        deploy:
            runs-on: ubuntu-latest
            steps:
                - uses: actions/checkout@v3
                
                - name: Setup Node.js
                  uses: actions/setup-node@v3
                  with:
                      node-version: '18'
                
                - name: Install dependencies
                  run: |
                      cd web
                      npm ci
                
                - name: Build
                  run: |
                      cd web
                      npm run build
                  env:
                      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
                      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
                
                - name: Deploy to Vercel
                  uses: amondnet/vercel-action@v20
                  with:
                      vercel-token: ${{ secrets.VERCEL_TOKEN }}
                      vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
                      vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}

### 7.2 手動デプロイ

    # Webダッシュボード
    cd web
    npm run build
    vercel --prod
    
    # 拡張機能（zipファイル作成）
    cd extension
    npm run build
    zip -r research-vault-extension.zip . -x "*.git*" "node_modules/*"

## 8. バックアップとデータ管理

### 8.1 自動バックアップ
- Supabase: 毎日自動バックアップ（過去7日分）
- 手動バックアップ: 週次でpg_dumpを実行

### 8.2 データエクスポート

    # scripts/backup.sh
    #!/bin/bash
    
    DATE=$(date +%Y%m%d)
    SUPABASE_DB_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
    
    pg_dump $SUPABASE_DB_URL > backup_${DATE}.sql
    
    # S3やGoogle Driveにアップロード（オプション）

## 9. モニタリング

### 9.1 Supabase Dashboard
- リアルタイムのAPI使用状況
- データベースパフォーマンス
- エラーログ

### 9.2 Vercel Analytics
- ページビュー
- Web Vitals
- エラー追跡

### 9.3 カスタムロギング

    // web/src/utils/logger.js
    
    class Logger {
        static log(action, data) {
            if (process.env.NODE_ENV === 'production') {
                // Supabaseのlogsテーブルに記録
                supabase.from('logs').insert({
                    action,
                    data,
                    user_id: supabase.auth.user()?.id,
                    timestamp: new Date()
                });
            } else {
                console.log(action, data);
            }
        }
    }

## 10. セキュリティ設定

### 10.1 環境変数の管理
- `.env.local`はGitにコミットしない
- Vercelの環境変数は暗号化保存
- APIキーは最小権限の原則

### 10.2 CORS設定

    // Vercelのapi/ディレクトリ内
    export default function handler(req, res) {
        res.setHeader('Access-Control-Allow-Origin', 'chrome-extension://your-extension-id');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // APIロジック
    }

### 10.3 Rate Limiting
- Supabaseの標準レート制限を使用
- 必要に応じてカスタム制限を実装

これらの設定により、完全に無料で運用可能な研究資料管理システムを構築できます。
