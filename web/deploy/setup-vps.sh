#!/usr/bin/env bash
# VPS 初回セットアップ（Apache + systemd）
# 実行: cd /var/www/ResearchVault/web && ./deploy/setup-vps.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> ResearchVault VPS setup ($ROOT)"

if [[ ! -f server.js ]]; then
  echo "ERROR: server.js がありません。最新コードをデプロイしてください。"
  exit 1
fi

echo "==> npm ci"
npm ci

if [[ ! -d dist ]]; then
  echo "==> npm run build"
  npm run build
fi

echo "==> systemd"
SERVICE=/etc/systemd/system/researchvault.service
if [[ -f deploy/researchvault.service ]]; then
  sed "s|/var/www/ResearchVault/web|$ROOT|g; s|^User=.*|User=$(whoami)|; s|^Group=.*|Group=$(id -gn)|" \
    deploy/researchvault.service | sudo tee "$SERVICE" > /dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable researchvault
  sudo systemctl restart researchvault
  sleep 12
  sudo systemctl status researchvault --no-pager || true
else
  echo "WARN: deploy/researchvault.service がありません"
fi

echo "==> smoke test (Node direct)"
curl -sf http://127.0.0.1:3001/api/health && echo ""

echo ""
echo "次: Apache を ProxyPass に変更してください。"
echo "  参考: deploy/rv.insas.jp.apache.conf"
echo "  sudo apache2ctl configtest && sudo systemctl reload apache2"
echo "  curl -s https://rv.insas.jp/api/health"
