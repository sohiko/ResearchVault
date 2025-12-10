import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-secondary-800 rounded-lg shadow-md p-8">
        <div className="mb-8">
          <Link 
            to="/dashboard" 
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
          >
            ← ダッシュボードに戻る
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-100 mb-8">
          プライバシーポリシー
        </h1>

        <div className="prose dark:prose-invert max-w-none space-y-6 text-secondary-700 dark:text-secondary-300">
          <section>
            <p>
              ResearchVault（以下「当サービス」）は、Chrome拡張機能とWebダッシュボードを用いた研究支援サービスです。
              特に拡張機能によりWeb閲覧情報を取得するため、取扱う情報と保護方針を以下のとおり定めます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">1. 取得する情報</h2>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>アカウント情報（メールアドレスなど登録時に入力された情報）</li>
              <li>拡張機能経由で保存するWebページのURL、タイトル、取得時刻、メタデータ</li>
              <li>ユーザーが選択して保存したテキスト、ページ内ブックマーク位置</li>
              <li>研究候補検出のために利用する閲覧履歴（拡張機能が明示的に許可を求めた範囲）</li>
              <li>ログ・イベント情報（エラー、同期状況などの技術的記録）</li>
              <li>Cookie / ローカルストレージ等に保持されるセッション・設定情報</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">2. 取得方法とユーザー操作</h2>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>拡張機能は、初回インストール時や特定機能利用時に権限を明示し、同意を前提に動作します。</li>
              <li>ページ保存・テキスト保存・ブックマーク作成は、ユーザーの操作（クリック・選択）でのみ保存します。</li>
              <li>閲覧履歴の利用は研究候補提示の目的に限定し、ブラウザ設定や拡張機能の無効化・削除で停止できます。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">3. 利用目的</h2>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>研究資料の保存・整理・引用生成、候補提示のため</li>
              <li>ユーザーサポート、問い合わせ対応、重要なお知らせの送付のため</li>
              <li>機能改善・品質向上、障害対応、セキュリティ確保のため</li>
              <li>不正利用の防止および利用規約に基づく対応のため</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">4. 保存期間と削除</h2>
            <p>サービス提供に必要な期間保存し、アカウント削除時は遅滞なく削除します（法令で保存義務がある場合を除く）。</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">5. 第三者提供</h2>
            <p>法令に基づく場合を除き、ユーザーの同意なく第三者に提供しません。</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">6. 利用中の第三者サービス</h2>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li><strong>Supabase</strong>: 認証・データベース・ストレージ</li>
              <li><strong>Vercel</strong>: ホスティング</li>
              <li><strong>Google Gemini API</strong>: AI分類・抽出（研究資料補助）</li>
              <li><strong>Microlink.io</strong>: Webページのメタデータ取得</li>
            </ul>
            <p className="mt-3">各サービスは独自のプライバシーポリシーに従いデータを取り扱います。</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">7. ユーザーの権利</h2>
            <p>登録情報や保存データの閲覧・訂正・削除、アカウント削除を行う権利があります。ブラウザ設定や拡張機能の無効化で収集を停止できます。</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">8. セキュリティ対策</h2>
            <p>通信の暗号化、アクセス制御、権限最小化、ログ監査、脆弱性対応などの技術的・組織的対策を講じます。</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">9. 改定</h2>
            <p>内容を変更する場合は本ページで通知し、改定後に効力を生じます。</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100 mb-4">10. お問い合わせ</h2>
            <p>本ポリシーに関するお問い合わせは、アプリ内のフィードバック機能からご連絡ください。</p>
          </section>

          <div className="mt-8 pt-8 border-t border-secondary-200 dark:border-secondary-700">
            <p className="text-sm text-secondary-500">最終更新日：2025年12月10日</p>
          </div>
        </div>
      </div>
    </div>
  )
}

