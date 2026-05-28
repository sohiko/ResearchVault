# VPS デプロイ手順（Ubuntu + Apache2 + systemd）

本番 URL: https://rv.insas.jp

Vercel から VPS に移行した場合、**静的ファイル（`dist/`）だけを Apache で配信していると `/api/*` が `index.html` を返し**、文献作成で次のエラーになります。

```
Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**対処:** Node で `web/server.js` を常駐させ、Apache はその手前でリバースプロキシにします。

---

## 構成図

```
ブラウザ → Apache2 (80/443) → Node server.js (127.0.0.1:3001)
                                    ├─ /api/*  → web/api/*.js
                                    └─ /*      → web/dist/ (React)
```

---

## 0. 現在の VPS 状態を確認（既存設定の調査）

SSH で VPS に入り、次を実行して **いま何が動いているか** を把握します。

```bash
# OS
lsb_release -a

# Apache
sudo systemctl status apache2
sudo apache2ctl -M | grep -E 'proxy|ssl|rewrite'
ls -la /etc/apache2/sites-enabled/

# 既存の rv.insas.jp 設定（ファイル名は環境により異なる）
grep -r "rv.insas.jp" /etc/apache2/sites-enabled/ 2>/dev/null
grep -r "DocumentRoot\|ProxyPass" /etc/apache2/sites-enabled/ 2>/dev/null

# systemd（ResearchVault 関連があるか）
systemctl list-units --type=service | grep -iE 'research|vault|node|rv'
ls /etc/systemd/system/*.service 2>/dev/null | xargs grep -l -i research 2>/dev/null

# Node
node -v
which node

# リポジトリの場所（例）
ls -la /var/www/
```

**よくある既存パターン**

| パターン | 症状 | 対応 |
|---------|------|------|
| `DocumentRoot` が `dist/` のみ | `/api/*` が HTML | 下記の ProxyPass 構成に変更 |
| 別ポートで Node が既に動いている | ポート競合 | `PORT` と Apache の ProxyPass 先を揃える |
| systemd ユニットが既にある | 二重起動 | 既存ユニットを更新するか置き換え |

---

## 1. 必要パッケージ

```bash
sudo apt update
sudo apt install -y git curl apache2

# Node.js 22 LTS（例: NodeSource）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v22 以上推奨（package.json engines 参照）
```

---

## GitHub 自動デプロイ向け（env を GitHub で管理している場合）

- VPS に手動で `.env` を作る必要はありません。デプロイスクリプトまたは systemd が **GitHub Secrets から生成した `.env`** を使う形にします。
- **重要:** デプロイ対象は `dist/` だけでは不十分です。`server.js`・`api/`・`node_modules`（`npm ci`）も VPS に必要です。
- 続きの手順（既存 `rv.insas.jp` Apache の編集・ポート 3001）: [deploy-vps-github-続き.md](./deploy-vps-github-続き.md)
- GitHub Actions でビルドする場合、Repository secrets に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 等を登録してください（`build.yml` で Build 時に注入）。

---

## 2. ソースの配置

```bash
sudo mkdir -p /var/www
cd /var/www

# 初回
sudo git clone https://github.com/sohiko/ResearchVault.git
sudo chown -R $USER:$USER ResearchVault

# 更新時
cd /var/www/ResearchVault
git pull
```

以降、パスは `/var/www/ResearchVault/web` を前提とします（環境に合わせて変更可）。

---

## 3. 環境変数

```bash
cd /var/www/ResearchVault/web
cp deploy/env.production.example .env
nano .env   # Supabase キー等を本番値に編集
```

**重要**

- `VITE_*` は **`npm run build` の前** に `.env` に置く（Vite がビルド時に埋め込む）
- `SUPABASE_SERVICE_ROLE_KEY` は API（招待・プロジェクト等）用。リポジトリにコミットしない

---

## 4. ビルドとローカル動作確認

```bash
cd /var/www/ResearchVault/web
npm ci
npm run build

# 一時的に起動して API が JSON を返すか確認
PORT=3000 node server.js &
sleep 15   # 初回は API モジュール preload で十数秒かかることがある
curl -s http://127.0.0.1:3000/api/health
curl -s -X POST http://127.0.0.1:3000/api/reference-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | head -c 120
# → {"isPdf":... の JSON が見えれば OK（<!DOCTYPE なら NG）
kill %1
```

---

## 5. systemd（常駐化）

### 5.1 ユニットファイルの設置

```bash
cd /var/www/ResearchVault/web

# User / WorkingDirectory / EnvironmentFile を VPS に合わせて編集
nano deploy/researchvault.service

sudo cp deploy/researchvault.service /etc/systemd/system/researchvault.service
sudo systemctl daemon-reload
```

`deploy/researchvault.service` で必ず合わせる項目:

| 項目 | 例 |
|------|-----|
| `User` / `Group` | `ubuntu`（実際に git pull するユーザー） |
| `WorkingDirectory` | `/var/www/ResearchVault/web` |
| `EnvironmentFile` | `/var/www/ResearchVault/web/.env` |
| `ExecStart` | `which node` のパス（例 `/usr/bin/node`） |

### 5.2 起動・自動起動

```bash
sudo systemctl enable researchvault
sudo systemctl start researchvault
sudo systemctl status researchvault

# ログ追跡
sudo journalctl -u researchvault -f
```

### 5.3 コード更新時の手順

```bash
cd /var/www/ResearchVault
git pull
cd web
npm ci
npm run build
sudo systemctl restart researchvault
```

---

## 6. Apache2（リバースプロキシ）

### 6.1 モジュール有効化

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo systemctl restart apache2
```

### 6.2 サイト設定

```bash
cd /var/www/ResearchVault/web
sudo cp deploy/apache-rv.insas.jp.conf /etc/apache2/sites-available/researchvault.conf

# 既存の rv.insas.jp サイトと競合する場合は無効化
# sudo a2dissite 旧サイト名.conf

sudo a2ensite researchvault
sudo apache2ctl configtest
sudo systemctl reload apache2
```

**ポイント:** Apache は **静的 `dist/` を直接配信せず**、すべて `http://127.0.0.1:3000/` にプロキシします。Node 側が静的ファイルと API の両方を担当します。

### 6.3 HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d rv.insas.jp
```

証明書取得後、`deploy/apache-rv.insas.jp.conf` 内の `*:443` VirtualHost のコメントを外し、パスを certbot の出力に合わせてから:

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## 7. 本番確認チェックリスト

```bash
# Node が生きている
curl -s http://127.0.0.1:3000/api/health

# Apache 経由（ドメイン）
curl -s https://rv.insas.jp/api/health

# 文献作成の要 API（JSON であること）
curl -s -X POST https://rv.insas.jp/api/reference-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | head -c 150
```

ブラウザで文献作成を試し、開発者ツールの Network で `/api/reference-info` の **Content-Type が `application/json`** であることを確認してください。

---

## 8. トラブルシューティング

### まだ `<!DOCTYPE` / JSON パースエラー

- Apache がまだ `DocumentRoot` で `dist/` だけ配信している
- `researchvault.service` が停止している → `sudo systemctl status researchvault`
- ProxyPass 先のポートが `PORT` と不一致

```bash
sudo ss -tlnp | grep -E '3000|apache'
curl -sI https://rv.insas.jp/api/health | grep -i content-type
```

### `systemctl start` が失敗する

```bash
sudo journalctl -u researchvault -n 50 --no-pager
```

- `WorkingDirectory` が誤り
- `npm run build` 未実行で `dist/` が無い（警告のみで起動はするがフロント不可）
- `.env` の `SUPABASE_SERVICE_ROLE_KEY` 未設定で一部 API は初回アクセス時に失敗（文献作成の reference-info は Supabase 不要）

### Apache `AH01144: No protocol handler`

```bash
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

### 502 Bad Gateway

- Node が起動していない、またはクラッシュループ
- SELinux/AppArmor は Ubuntu 標準では通常影響小

```bash
sudo systemctl restart researchvault
curl -s http://127.0.0.1:3000/api/health
```

### 初回の文献作成だけ極端に遅い

- `server.js` は起動時に `reference-info` 等をプリロード（約10〜15秒）。`journalctl` で `Critical API handlers ready` を確認してからトラフィックを流す

---

## 9. リポジトリ内の関連ファイル

| ファイル | 用途 |
|---------|------|
| `web/server.js` | 本番 Node サーバー |
| `web/deploy/researchvault.service` | systemd ユニット |
| `web/deploy/apache-rv.insas.jp.conf` | Apache バーチャルホスト |
| `web/deploy/env.production.example` | `.env` テンプレート |
| `web/deploy/deploy.sh` | 更新用ワンライナースクリプト |
| `web/nginx.conf.example` | nginx 利用時のみ |

---

## 10. セキュリティメモ

- `.env` の権限: `chmod 600 .env`
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー上のみ
- ファイアウォールで **3000 番は外部公開しない**（127.0.0.1 のみ。Apache だけ 80/443 を公開）

```bash
sudo ufw allow 'Apache Full'
# Node 3000 は ufw で開放しない
```
