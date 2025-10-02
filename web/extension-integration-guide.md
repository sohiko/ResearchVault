# ResearchVault Chrome拡張機能 統合ガイド

## 概要
このガイドでは、ResearchVault Chrome拡張機能がウェブサイトと適切に連携するための実装方法を説明します。

## グローバルオブジェクトの公開

### 1. Content Scriptでの実装

拡張機能のContent Scriptで以下のグローバルオブジェクトを公開してください：

```javascript
// content.js
(function() {
  'use strict';

  // ResearchVault拡張機能のグローバルオブジェクトを公開
  window.ResearchVaultExtension = {
    version: '1.0.0',
    installed: true,
    connected: true,
    timestamp: Date.now(),
    
    // ウェブサイトからのメッセージをリッスン
    init: function() {
      // ウェブサイトからのメッセージをリッスン
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'RESEARCHVAULT_EXTENSION_CHECK') {
          // ウェブサイトに応答を送信
          window.postMessage({
            type: 'RESEARCHVAULT_EXTENSION_RESPONSE',
            source: 'extension',
            version: this.version,
            timestamp: Date.now()
          }, '*');
        }
      });

      // ページ読み込み完了時にウェブサイトに通知
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.notifyPageLoaded();
        });
      } else {
        this.notifyPageLoaded();
      }
    },

    // ページ読み込み完了を通知
    notifyPageLoaded: function() {
      window.postMessage({
        type: 'RESEARCHVAULT_EXTENSION_READY',
        source: 'extension',
        version: this.version,
        timestamp: Date.now()
      }, '*');
    },

    // 認証データの同期
    syncAuth: function(authData) {
      // 認証データを拡張機能に保存
      chrome.storage.local.set({
        'researchvault_auth': authData,
        'auth_sync_timestamp': Date.now()
      });
    },

    // 拡張機能の状態を取得
    getStatus: function() {
      return {
        installed: true,
        connected: true,
        version: this.version,
        timestamp: Date.now()
      };
    }
  };

  // 初期化
  window.ResearchVaultExtension.init();

  // DOM要素に拡張機能の痕跡を追加
  const meta = document.createElement('meta');
  meta.name = 'researchvault-extension';
  meta.content = 'installed';
  document.head.appendChild(meta);

  // データ属性を追加
  document.body.setAttribute('data-researchvault', 'installed');

})();
```

### 2. Manifest.jsonの設定

```json
{
  "manifest_version": 3,
  "name": "ResearchVault",
  "version": "1.0.0",
  "description": "ResearchVault Chrome Extension",
  
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ],
  
  "web_accessible_resources": [
    {
      "resources": ["injected.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 3. Background Scriptでの実装

```javascript
// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    // ウェブサイトからのpingに応答
    sendResponse({ status: 'ok', timestamp: Date.now() });
  }
  
  if (request.action === 'syncAuth') {
    // 認証データの同期
    chrome.storage.local.set({
      'researchvault_auth': request.data,
      'auth_sync_timestamp': Date.now()
    });
    sendResponse({ status: 'synced' });
  }
});
```

## 拡張機能用APIエンドポイント

### 1. 認証エンドポイント

拡張機能専用の認証エンドポイントが利用可能です：

```
POST /api/extension/auth
```

**リクエスト例:**
```javascript
const response = await fetch('https://research-vault-eight.vercel.app/api/extension/auth', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Extension-Version': '1.0.0',
    'X-Client-Info': 'chrome-extension'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await response.json();
if (data.success) {
  console.log('ログイン成功:', data.user);
  // トークンを保存
  localStorage.setItem('auth_token', data.token);
}
```

### 2. ヘルスチェックエンドポイント

```
GET /api/extension/health
```

**リクエスト例:**
```javascript
const response = await fetch('https://research-vault-eight.vercel.app/api/extension/health', {
  method: 'GET',
  headers: {
    'X-Extension-Version': '1.0.0',
    'X-Client-Info': 'chrome-extension'
  }
});

const data = await response.json();
console.log('API状態:', data.status);
```

## ウェブサイト側での検出方法

### 1. グローバルオブジェクトのチェック

```javascript
// 拡張機能の存在をチェック
if (window.ResearchVaultExtension && typeof window.ResearchVaultExtension === 'object') {
  console.log('ResearchVault拡張機能が検出されました');
  console.log('バージョン:', window.ResearchVaultExtension.version);
  
  // 拡張機能の状態を取得
  const status = window.ResearchVaultExtension.getStatus();
  console.log('拡張機能の状態:', status);
}
```

### 2. DOM要素のチェック

```javascript
// DOM要素に拡張機能の痕跡があるかチェック
const hasExtensionElements = document.querySelector('[data-researchvault]') ||
  document.querySelector('meta[name="researchvault-extension"]');

if (hasExtensionElements) {
  console.log('拡張機能の痕跡が検出されました');
}
```

### 3. メッセージング

```javascript
// 拡張機能にメッセージを送信
window.postMessage({
  type: 'RESEARCHVAULT_EXTENSION_CHECK',
  source: 'webpage',
  timestamp: Date.now()
}, '*');

// 拡張機能からの応答をリッスン
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RESEARCHVAULT_EXTENSION_RESPONSE') {
    console.log('拡張機能からの応答を受信:', event.data);
  }
});
```

## 認証データの同期

### ウェブサイト側

```javascript
// 認証データを拡張機能に同期
if (window.ResearchVaultExtension) {
  const authData = {
    token: session.access_token,
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split('@')[0]
    },
    expires_at: session.expires_at
  };
  
  window.ResearchVaultExtension.syncAuth(authData);
}
```

### 拡張機能側

```javascript
// 認証データを保存
chrome.storage.local.set({
  'researchvault_auth': authData,
  'auth_sync_timestamp': Date.now()
});
```

## トラブルシューティング

### 1. 拡張機能が検出されない場合

- Content Scriptが正しく読み込まれているか確認
- `run_at: "document_start"`が設定されているか確認
- グローバルオブジェクトが正しく公開されているか確認

### 2. メッセージングが動作しない場合

- `postMessage`の送信先が`'*'`になっているか確認
- イベントリスナーが正しく設定されているか確認
- Content Security Policyの制限を確認

### 3. 認証データの同期が失敗する場合

- `chrome.storage`の権限が設定されているか確認
- データの形式が正しいか確認
- ストレージの容量制限を確認

## 注意事項

1. **セキュリティ**: 認証データは適切に暗号化して保存してください
2. **パフォーマンス**: グローバルオブジェクトの初期化は軽量化してください
3. **互換性**: 異なるブラウザでの動作を確認してください
4. **エラーハンドリング**: 適切なエラーハンドリングを実装してください

## サンプル実装

完全なサンプル実装は、このリポジトリの`extension-samples/`ディレクトリを参照してください。
