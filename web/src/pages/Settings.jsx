import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState({
    notifications: true,
    autoSave: true,
    citationFormat: 'APA',
    language: 'ja',
    dashboardLayout: 'grid',
    itemsPerPage: 20
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const loadSettings = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      
      // ユーザー設定を取得（まだテーブルがない場合はデフォルト値を使用）
      const { data: userSettings, error } = await supabase
        .from('citation_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (userSettings?.settings) {
        setSettings({
          ...settings,
          ...userSettings.settings,
          citationFormat: userSettings.default_style || 'APA'
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      setError('設定の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [user, settings])

  useEffect(() => {
    if (user) {
      loadSettings()
    }
  }, [user, loadSettings])

  const saveSettings = async () => {
    try {
      setSaving(true)
      setError(null)

      // citation_settingsテーブルに保存
      const { error } = await supabase
        .from('citation_settings')
        .upsert({
          user_id: user.id,
          default_style: settings.citationFormat,
          settings: {
            notifications: settings.notifications,
            autoSave: settings.autoSave,
            language: settings.language,
            dashboardLayout: settings.dashboardLayout,
            itemsPerPage: settings.itemsPerPage
          }
        })

      if (error) {
        throw error
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setError('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          設定
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          アプリケーションの設定を管理します
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm">設定を保存しました</p>
        </div>
      )}

      {/* 表示設定 */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
            表示設定
          </h3>
        </div>
        <div className="p-6 space-y-6">
          {/* テーマ設定 */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
              テーマ
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => theme === 'dark' && toggleTheme()}
                className={`p-4 border rounded-lg transition-colors ${
                  theme === 'light' 
                    ? 'border-primary-500 bg-primary-50 text-primary-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white border border-gray-300 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                  </div>
                  <span className="font-medium">ライトモード</span>
                </div>
              </button>
              
              <button
                onClick={() => theme === 'light' && toggleTheme()}
                className={`p-4 border rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'border-primary-500 bg-primary-50 text-primary-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" />
                    </svg>
                  </div>
                  <span className="font-medium">ダークモード</span>
                </div>
              </button>
            </div>
          </div>

          {/* ダッシュボードレイアウト */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
              ダッシュボードレイアウト
            </label>
            <select
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={settings.dashboardLayout}
              onChange={(e) => updateSetting('dashboardLayout', e.target.value)}
            >
              <option value="grid">グリッド表示</option>
              <option value="list">リスト表示</option>
              <option value="compact">コンパクト表示</option>
            </select>
          </div>

          {/* 1ページあたりの表示件数 */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
              1ページあたりの表示件数
            </label>
            <select
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={settings.itemsPerPage}
              onChange={(e) => updateSetting('itemsPerPage', parseInt(e.target.value))}
            >
              <option value={10}>10件</option>
              <option value={20}>20件</option>
              <option value={50}>50件</option>
              <option value={100}>100件</option>
            </select>
          </div>
        </div>
      </div>

      {/* 引用設定 */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
            引用設定
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">
              デフォルト引用形式
            </label>
            <select
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={settings.citationFormat}
              onChange={(e) => updateSetting('citationFormat', e.target.value)}
            >
              <option value="APA">APA 7th Edition</option>
              <option value="MLA">MLA 9th Edition</option>
              <option value="Chicago">Chicago 17th Edition</option>
              <option value="Harvard">Harvard</option>
              <option value="IEEE">IEEE</option>
            </select>
            <p className="mt-2 text-sm text-secondary-500">
              Chrome拡張機能での引用生成時に使用される形式です
            </p>
          </div>
        </div>
      </div>

      {/* 機能設定 */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
            機能設定
          </h3>
        </div>
        <div className="p-6 space-y-6">
          {/* 通知設定 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                通知
              </h4>
              <p className="text-sm text-secondary-500">
                保存完了やエラーの通知を表示します
              </p>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.notifications ? 'bg-primary-600' : 'bg-gray-200'
              }`}
              onClick={() => updateSetting('notifications', !settings.notifications)}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.notifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 自動保存 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                自動保存
              </h4>
              <p className="text-sm text-secondary-500">
                Chrome拡張機能でページを訪問時に自動で保存候補を表示します
              </p>
            </div>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                settings.autoSave ? 'bg-primary-600' : 'bg-gray-200'
              }`}
              onClick={() => updateSetting('autoSave', !settings.autoSave)}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.autoSave ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* アカウント・データ管理 */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
            アカウント・データ管理
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                データエクスポート
              </h4>
              <p className="text-sm text-secondary-500">
                すべての参照データをJSONファイルとしてダウンロードします
              </p>
            </div>
            <button className="btn-secondary">
              エクスポート
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
                キャッシュクリア
              </h4>
              <p className="text-sm text-secondary-500">
                ローカルキャッシュをクリアして動作を高速化します
              </p>
            </div>
            <button className="btn-secondary">
              クリア
            </button>
          </div>
        </div>
      </div>

      {/* 保存ボタン */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  )
}
