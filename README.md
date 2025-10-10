# ResearchVault

ResearchVaultは、IB生を中心とした学生の研究活動を支援する参照管理システムです。Chrome拡張機能とWebダッシュボードで構成され、レポート作成時の参考文献管理を効率化します。

## 🌟 主な機能

- **🌐 Webページの瞬時保存**: Chrome拡張機能でワンクリック保存
- **✂️ 選択テキストの記録**: 重要な箇所をハイライト保存
- **🔖 ページ内ブックマーク**: 特定の位置への素早いアクセス
- **📝 自動引用生成**: APA、MLA、Chicago等の形式に対応
- **📂 プロジェクト別整理**: Extended Essay、TOK、IA等で分類
- **👥 チーム共有**: メンバーとの協働研究をサポート
- **🔍 記録漏れ候補表示**: 学術サイトの訪問履歴から候補を自動検出

## 🎯 対象ユーザー

- **主要ターゲット**: 広島叡智学園の生徒（IB課程）
- **二次ターゲット**: 一般の高校生・大学生

## 🛠️ 技術スタック

### Chrome拡張機能
- Manifest V3
- JavaScript (ES6+)
- Chrome Storage API
- HTML/CSS

### Webダッシュボード
- **フロントエンド**: React.js 18+, Tailwind CSS, React Router v6
- **バックエンド**: Supabase (PostgreSQL, Storage, Auth)
- **ホスティング**: Vercel

## 📁 プロジェクト構造

```
ResearchVault/
├── extension/                 # Chrome拡張機能
│   ├── manifest.json         # 拡張機能マニフェスト
│   ├── popup/                # ポップアップUI
│   ├── background/           # バックグラウンドスクリプト
│   ├── content/              # コンテンツスクリプト
│   ├── icons/                # アイコンファイル
│   └── lib/                  # 共通ライブラリ
├── web/                      # Webダッシュボード
│   ├── src/
│   │   ├── components/       # Reactコンポーネント
│   │   ├── pages/           # ページコンポーネント
│   │   ├── hooks/           # カスタムフック
│   │   ├── lib/             # Supabaseクライアント
│   │   └── styles/          # スタイルファイル
│   ├── public/              # 静的ファイル
│   └── package.json
├── supabase/                # Supabase設定
│   ├── migrations/          # データベースマイグレーション
│   └── seed.sql             # 初期データ
├── docs/                    # ドキュメント
├── scripts/                 # ユーティリティスクリプト
└── specs/                   # 仕様書
```

## 🚀 セットアップ

### 前提条件

- Node.js 18+
- npm or yarn
- Git
- Chromeブラウザ


## 📖 使用方法

### Chrome拡張機能

1. **ページ保存**: 拡張機能アイコンをクリック → 情報入力 → 保存
2. **選択テキスト保存**: テキスト選択 → 右クリック → "選択テキストを保存"
3. **ブックマーク作成**: 右クリック → "ページ内ブックマークを作成"

### Webダッシュボード

1. **プロジェクト作成**: サイドバー → "+" → プロジェクト情報入力
2. **参照管理**: 参照一覧 → フィルター・検索・編集
3. **引用生成**: 引用生成ページ → フォーマット選択 → コピー


## 📊 対応引用フォーマット

- APA 7th Edition
- APA 6th Edition  
- MLA 9th Edition
- Chicago 17th Edition
- Harvard
- IEEE

## 🤝 コントリビューション

1. フォークする
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. コミット (`git commit -m 'Add some amazing feature'`)
4. プッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 👥 作成者

- **Sohiko Misaki** - [GitHub](https://github.com/sohiko)

## 🙏 謝辞

- 広島叡智学園のIB生のフィードバック
- オープンソースコミュニティの貢献
- Supabase、Vercel、Reactの素晴らしいツール

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/sohiko/ResearchVault/issues)
- **フィードバック**: アプリ内の機能リクエスト機能

---

**ResearchVault** - 研究活動をもっと効率的に 🚀
