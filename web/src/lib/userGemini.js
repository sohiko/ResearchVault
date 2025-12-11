import { supabase } from './supabase'

// ユーザー固有のGemini APIキーを取得
export async function getUserGeminiApiKey(userId) {
  if (!userId) {
    return { apiKey: null, enabled: false }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('gemini_api_key, gemini_api_key_enabled')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return {
    apiKey: data?.gemini_api_key || null,
    enabled: !!(data?.gemini_api_key && data?.gemini_api_key_enabled)
  }
}

// 有効なキーをユーザー設定優先で解決し、なければ環境変数を返す
export async function resolveGeminiApiKey(userId, fallbackEnvKey = null) {
  try {
    const { apiKey, enabled } = await getUserGeminiApiKey(userId)
    if (apiKey && enabled) {
      return { apiKey, source: 'user' }
    }
  } catch (error) {
    console.error('Failed to load Gemini API key:', error)
  }

  if (fallbackEnvKey) {
    return { apiKey: fallbackEnvKey, source: 'env' }
  }

  return { apiKey: null, source: 'none' }
}

