# VPS 続きの手順（GitHub 自動デプロイ・既存 Apache 向け）

手順 1 まで完了したあと、**このドキュメントの 2〜4** を実行してください。

## あなたの環境で分かったこと

| 項目 | 状態 |
|------|------|
| `rv.insas.jp.conf` / SSL | 既に `sites-enabled` にあり（5/28 作成） |
| `researchvault` systemd | **未登録** |
| Node | v22 に更新済み |
| `dev.insas.jp` | **127.0.0.1:3000** を使用中 → **rv は 3001 を使う** |
| GitHub 連携 | env は GitHub 管理（VPS に手動 `.env` は不要な場合あり） |
| `deploy/` 一式 | **main に push されるまで** VPS には無い（`cp deploy/...` が失敗した理由） |

---

## 前提: コードを GitHub に push する

次のファイルが **main ブランチ** に無いと API は動きません。

- `web/server.js`
- `web/package.json` の `express` 依存
- `web/deploy/` ディレクトリ

ローカルでコミット・push 後、VPS で自動デプロイを待つか、手動で `git pull` してください。

```bash
cd /var/www/ResearchVault   # 自動デプロイの実パスが違う場合はそちら
git pull origin main
cd web
npm ci    # express を入れる
npm run build   # GitHub でビルド済みならスキップ可
```

**自動デプロイが `dist/` だけ配信している場合**は、`server.js` と `api/` が VPS に届いていません。フック／スクリプトを **リポジトリ全体の `web/`** を配置するよう変更してください。

---

## 2. 既存 Apache（rv.insas.jp）を修正

まず現在の設定を確認:

```bash
sudo cat /etc/apache2/sites-available/rv.insas.jp.conf
sudo cat /etc/apache2/sites-available/rv.insas.jp-ssl.conf
```

### パターン A: `DocumentRoot` で `dist` を配信している（エラーの原因）

`DocumentRoot` / `Directory` / `FallbackResource` を **やめ**、次に置き換えます（`:443` 側も同様）:

```apache
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"

    ProxyPass        / http://127.0.0.1:3001/
    ProxyPassReverse / http://127.0.0.1:3001/
```

### パターン B: 既に ProxyPass がある

`127.0.0.1:3000` になっていたら **3001** に変更（dev と競合しないように）。

### モジュールと反映

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo apache2ctl configtest
sudo systemctl reload apache2
```

リポジトリの雛形: `web/deploy/apache-rv.insas.jp.conf`（新規サイトではなく、**既存ファイルの編集**用の参考）

---

## 3. systemd（初回のみ）

```bash
cd /var/www/ResearchVault/web

# パス・ユーザーを確認してからコピー
nano deploy/researchvault.service
# User=sohiko0619
# WorkingDirectory=/var/www/ResearchVault/web  （自動デプロイの実パス）
# PORT は 3001 のまま

sudo cp deploy/researchvault.service /etc/systemd/system/researchvault.service
sudo systemctl daemon-reload
sudo systemctl enable researchvault
sudo systemctl start researchvault
sudo systemctl status researchvault
```

### GitHub の環境変数を systemd に渡す

デプロイのたびに `.env` を生成する例（VPS 上のデプロイスクリプト）:

```bash
cat > /var/www/ResearchVault/web/.env <<EOF
NODE_ENV=production
PORT=3001
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
SUPABASE_URL=${VITE_SUPABASE_URL}
SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
EOF
chmod 600 /var/www/ResearchVault/web/.env
sudo systemctl restart researchvault
```

GitHub Actions でビルドする場合は **Repository secrets** に `VITE_*` を登録し、`.github/workflows/build.yml` の Build ステップで渡します（リポジトリ側で対応済み）。

---

## 4. 動作確認

```bash
# Node 直
curl -s http://127.0.0.1:3001/api/health

# Apache 経由
curl -s https://rv.insas.jp/api/health

# 文献作成 API（JSON であること）
curl -s -X POST https://rv.insas.jp/api/reference-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | head -c 120
```

`{"status":"healthy"` や `{"isPdf":` が見えれば成功。`<!DOCTYPE` の場合は Apache がまだ静的配信です。

---

## よくある質問

### 手動 clone の `/var/www/ResearchVault` と自動デプロイのパスが違う

自動デプロイ先を確認:

```bash
find /home /var/www -name "ResearchVault" -type d 2>/dev/null
```

`researchvault.service` の `WorkingDirectory` は **実際に更新されるパス** に合わせる。

### `npm run build` を GitHub でだけ実行している

- **フロント**: GitHub の artifact / rsync で `dist/` を配置
- **API**: VPS 上で `npm ci` 後 `node server.js` が必須（`server.js` + `api/` + `node_modules`）

両方必要です。

### ポート 3001 が空いているか

```bash
sudo ss -tlnp | grep -E '3000|3001'
```

---

## ワンコマンド初回セットアップ（コードデプロイ済みの場合）

```bash
cd /var/www/ResearchVault/web
chmod +x deploy/setup-vps.sh
./deploy/setup-vps.sh
```

その後 Apache を `deploy/rv.insas.jp.apache.conf` の :443 内容に合わせて編集。

---

## チェックリスト

- [ ] `server.js` が VPS の `web/` にある
- [ ] `npm ci` で `express` が入っている
- [ ] `researchvault.service` が active
- [ ] `rv.insas.jp-ssl.conf` が `ProxyPass` → `3001`
- [ ] `curl https://rv.insas.jp/api/reference-info` が JSON

### いまの状態（2026-05-28 確認）

`curl https://rv.insas.jp/api/reference-info` がまだ `Content-Type: text/html` の場合、**コードのデプロイは完了していても Apache が静的配信のまま**です。上記 Apache 変更が未適用です。
