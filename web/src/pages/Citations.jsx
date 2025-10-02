import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'

export default function Citations() {
  const { user } = useAuth()
  const [citationFormat, setCitationFormat] = useState('APA')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSettings = useCallback(async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('citation_settings')
        .select('default_style')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data?.default_style) {
        setCitationFormat(data.default_style)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadSettings()
    }
  }, [user, loadSettings])

  const saveSettings = async () => {
    if (!user) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('citation_settings')
        .upsert({
          user_id: user.id,
          default_style: citationFormat,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      toast.success('設定を保存しました')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="card p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100">
          引用設定
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          引用生成のデフォルト設定を管理します。実際の引用生成は各プロジェクトページで行えます。
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
              デフォルト引用形式
            </h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                引用形式
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={citationFormat}
                onChange={(e) => setCitationFormat(e.target.value)}
              >
                <option value="APA">APA 7th Edition</option>
                <option value="MLA">MLA 9th Edition</option>
                <option value="Chicago">Chicago 17th Edition</option>
                <option value="Harvard">Harvard</option>
              </select>
              <p className="text-sm text-secondary-500 mt-2">
                この設定は新しい引用生成時のデフォルトとして使用されます
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? '保存中...' : '設定を保存'}
              </button>
            </div>
          </div>
        </div>

        <div className="card mt-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-secondary-900 dark:text-secondary-100">
              引用生成について
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4 text-sm text-secondary-600 dark:text-secondary-400">
              <p>
                引用の生成は各プロジェクトページで行えます。プロジェクトページの上部にある「引用生成」ボタンをクリックすると、そのプロジェクトのすべての参照から引用文が生成されます。
              </p>
              <p>
                生成される引用文はプレーンテキスト形式で、各項目は改行で区切られたシンプルな構造になっています。
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-4">
                <h4 className="font-medium text-secondary-900 dark:text-secondary-100 mb-2">
                  対応している引用形式:
                </h4>
                <ul className="space-y-1">
                  <li>• APA 7th Edition</li>
                  <li>• MLA 9th Edition</li>
                  <li>• Chicago 17th Edition</li>
                  <li>• Harvard</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
