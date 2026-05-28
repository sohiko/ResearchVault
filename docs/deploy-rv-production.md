# rv.insas.jp 本番セットアップ（実環境向け）

**insas.jp には一切触れません。** 変更対象は次の2ファイルと systemd のみです。

| 変更する | 変更しない |
|---------|-----------|
| `/etc/apache2/sites-available/rv.insas.jp-ssl.conf` | `insas.conf`, `dev.insas.jp.conf` など |
| `/etc/systemd/system/researchvault.service` | 他ドメインの ProxyPass / DocumentRoot |

## 本番のディレクトリ構成（重要）

IDE / GitHub デプロイの実体は **`/var/www/ResearchVault` ではありません。**

```
/home/rv/www/
  public/     ← いまの dist（index.html, assets/）DocumentRoot 相当
  app/        ← 新規: server.js, api/, package.json, node_modules
```

Apache は `public/` を直接読むのをやめ、**Node (3001)** にプロキシします。

---

## ステップ 1: API ファイルを `/home/rv/www/app` に配置

ローカルで main を push したあと、VPS で **次のいずれか** で `app/` を用意します。

### 方法 A: git から app だけコピー（推奨）

```bash
# 一時 clone（または既存の ResearchVault からコピー）
git clone --depth 1 https://github.com/sohiko/ResearchVault.git /tmp/ResearchVault

sudo mkdir -p /home/rv/www/app
sudo rsync -av /tmp/ResearchVault/web/server.js \
              /tmp/ResearchVault/web/package.json \
              /tmp/ResearchVault/web/package-lock.json \
              /tmp/ResearchVault/web/api/ \
              /home/rv/www/app/
sudo chown -R rv:rv /home/rv/www/app

cd /home/rv/www/app
sudo -u rv npm ci
```

### 方法 B: IDE 手動アップロード

`web/` から次だけ `/home/rv/www/app/` へ:

- `server.js`
- `package.json`
- `package-lock.json`
- `api/` フォルダ一式

```bash
sudo chown -R rv:rv /home/rv/www/app
cd /home/rv/www/app && sudo -u rv npm ci
```

### 確認

```bash
ls -la /home/rv/www/app/server.js
ls -la /home/rv/www/public/index.html
```

---

## ステップ 2: systemd（masked 解除含む）

```bash
# 以前失敗すると masked になることがある
sudo systemctl unmask researchvault 2>/dev/null || true

sudo cp /path/to/repo/web/deploy/researchvault.service /etc/systemd/system/researchvault.service
# またはリポジトリから:
# sudo cp /tmp/ResearchVault/web/deploy/researchvault.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable researchvault
sudo systemctl start researchvault
sudo systemctl status researchvault
```

起動ログ（15秒ほど待つ）:

```bash
sudo journalctl -u researchvault -n 40 --no-pager
curl -s http://127.0.0.1:3001/api/health
```

`{"status":"healthy"` が JSON で返れば OK。

**環境変数:** GitHub Secrets は CI の `npm run build` で `VITE_*` に埋め込み済み。VPS に `.env` は不要です。

---

## ステップ 3: Apache（rv.insas.jp のみ）

```bash
sudo cp /tmp/ResearchVault/web/deploy/rv.insas.jp-ssl.conf \
        /etc/apache2/sites-available/rv.insas.jp-ssl.conf

sudo apache2ctl configtest
sudo systemctl reload apache2
```

`DocumentRoot` / `FallbackResource` は **削除** されています（ProxyPass のみ）。

---

## ステップ 4: 確認

```bash
curl -s http://127.0.0.1:3001/api/health
curl -s https://rv.insas.jp/api/health
curl -s -X POST https://rv.insas.jp/api/reference-info \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | head -c 80
```

成功例: `{"status":"healthy"` / `{"isPdf":false`

---

## よくあるエラー

| エラー | 原因 | 対処 |
|--------|------|------|
| `server.js` が無い | デプロイ先が `public/` のみ | ステップ 1 |
| `Unit is masked` | 以前の failed enable | `sudo systemctl unmask researchvault` |
| API が HTML | Apache がまだ DocumentRoot | ステップ 3 |
| 3001 が HTML | Node 未起動 | ステップ 2 |
| `npm ci` 権限 | 所有者不一致 | `chown -R rv:rv /home/rv/www/app` |

## 今後のデプロイ（GitHub Secrets のみ）

1. push → GitHub Actions が `VITE_*` 付きで build
2. 成果物 `dist/*` → `/home/rv/www/public/`（現行どおり）
3. `server.js` / `api/` 変更時のみ → `/home/rv/www/app/` へ同期 + `sudo systemctl restart researchvault`

`/var/www/ResearchVault` は検証用 clone であり、本番では使いません。
