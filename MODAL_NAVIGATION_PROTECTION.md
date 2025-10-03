# モーダルナビゲーション保護機能

## 概要
モーダルが開いている時のページ切り替えによる入力内容の消失を防ぐ機能を実装しました。

## 実装した機能

### 1. ナビゲーション制御フック (`useNavigationBlock.jsx`)
- **ページ離脱防止**: `beforeunload`イベントで確認ダイアログを表示
- **ブラウザ戻る/進む制御**: `popstate`イベントで戻る/進むボタンを制御
- **プログラマティックナビゲーション制御**: React Routerのナビゲーションを制御

### 2. モーダルコンテキスト (`useModalContext.jsx`)
- **グローバル状態管理**: 開いているモーダルの状態を管理
- **未保存変更追跡**: 各モーダルの未保存変更状態を追跡
- **モーダルデータ管理**: モーダル固有のデータを管理

### 3. 保護モーダルコンポーネント (`ProtectedModal.jsx`)
- **統一されたモーダルラッパー**: すべてのモーダルで共通の保護機能を提供
- **ESCキー対応**: ESCキーでモーダルを閉じる際も確認ダイアログを表示
- **背景クリック対応**: モーダル外クリック時も確認ダイアログを表示

## 対応済みモーダル

### 1. AddReferenceModal
- **保護対象**: URL、タイトル、説明、タグ、メモ、著者の入力内容
- **確認メッセージ**: "入力内容が失われますが、よろしいですか？"

### 2. EditProjectModal
- **保護対象**: プロジェクト名、説明、カラー、公開設定の変更
- **確認メッセージ**: "変更内容が失われますが、よろしいですか？"

### 3. EditReferenceModal
- **保護対象**: 参照情報の編集内容
- **確認メッセージ**: "変更内容が失われますが、よろしいですか？"

### 4. CreateProjectModal
- **保護対象**: プロジェクト名、説明の入力内容
- **確認メッセージ**: "入力内容が失われますが、よろしいですか？"

### 5. ShareProjectModal
- **保護対象**: 招待メールアドレスの入力内容
- **確認メッセージ**: "入力内容が失われますが、よろしいですか？"

## 動作仕様

### 1. 未保存変更の検出
各モーダルで以下の条件で未保存変更を検出：
- **新規作成系**: 入力フィールドに何らかの値が入力されている
- **編集系**: 元の値から変更されている

### 2. 保護される操作
- **ページ遷移**: React Routerによるページ切り替え
- **ブラウザ戻る/進む**: ブラウザの戻る/進むボタン
- **ページリロード**: F5キーやブラウザのリロードボタン
- **タブ/ウィンドウ閉じる**: ブラウザタブやウィンドウを閉じる操作
- **ESCキー**: ESCキーによるモーダル閉じる操作
- **背景クリック**: モーダル外の背景をクリックする操作

### 3. 確認ダイアログ
未保存の変更がある場合、以下の操作で確認ダイアログが表示されます：
- **OK/はい**: 変更を破棄してページを離脱
- **キャンセル/いいえ**: 現在のページに留まる

## 使用方法

### 新しいモーダルに保護機能を追加する場合

```jsx
import React, { useState, useEffect } from 'react'
import ProtectedModal from '../components/common/ProtectedModal'
import { useModalContext } from '../hooks/useModalContext'

const YourModal = ({ onClose }) => {
  const { openModal } = useModalContext()
  const modalId = 'your-modal'
  
  const [formData, setFormData] = useState({
    field1: '',
    field2: ''
  })

  // モーダルを開いた状態として登録
  useEffect(() => {
    openModal(modalId)
  }, [openModal])

  // 未保存の変更があるかチェック
  const hasUnsavedChanges = formData.field1.trim() || formData.field2.trim()

  return (
    <ProtectedModal 
      modalId={modalId}
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
      confirmMessage="入力内容が失われますが、よろしいですか？"
    >
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* モーダルの内容 */}
      </div>
    </ProtectedModal>
  )
}
```

## 技術的な詳細

### 1. イベントハンドリング
- `beforeunload`: ページ離脱時の確認
- `popstate`: ブラウザ履歴操作の制御
- `keydown`: ESCキー処理
- `click`: 背景クリック処理

### 2. 状態管理
- **Set**: 開いているモーダルIDの管理
- **Map**: モーダル固有データの管理
- **Context**: グローバル状態の共有

### 3. パフォーマンス最適化
- `useCallback`: 関数の再生成を防止
- `useEffect`: 適切な依存関係の管理
- イベントリスナーの適切なクリーンアップ

## 注意事項

1. **ブラウザ制限**: `beforeunload`イベントの確認ダイアログはブラウザによって表示が異なります
2. **モバイル対応**: モバイルブラウザでは一部の機能が制限される場合があります
3. **パフォーマンス**: 多数のモーダルが同時に開かれる場合は注意が必要です

## 今後の拡張可能性

1. **自動保存機能**: 一定間隔での自動保存
2. **復元機能**: ページリロード後の入力内容復元
3. **カスタム確認ダイアログ**: ブラウザ標準以外の確認ダイアログ
4. **詳細な変更追跡**: フィールド単位での変更追跡
