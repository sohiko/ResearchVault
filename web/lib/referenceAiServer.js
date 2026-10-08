import { createClient } from '@supabase/supabase-js'
import { generateReference } from '../src/lib/referenceAI.js'



export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {return res.status(405).json({ error: 'Method not allowed' })}
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]
  if (!token) {return res.status(401).json({ error: '認証が必要です' })}
  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {return res.status(401).json({ error: '無効な認証トークンです' })}
  const { apiKey, content = '', metadata = {}, pdfBase64 = null } = req.body || {}
  if (typeof apiKey !== 'string' || !apiKey.trim() || typeof content !== 'string' ||
      !metadata || typeof metadata !== 'object' || Array.isArray(metadata) ||
      (pdfBase64 !== null && (typeof pdfBase64 !== 'string' || pdfBase64.length > 4 * 1024 * 1024))) {
    return res.status(400).json({ error: 'AI解析の入力が不正です' })
  }
  try {
    const result = await generateReference({ apiKey, content: content.slice(0, 50000), metadata, pdfBase64, networkFallback: null })
    return res.status(200).json({ metadata: result })
  } catch (error) {
    console.error('Reference AI fallback failed:', error.code || error.name)
    return res.status(error.code === 'GEMINI_RATE_LIMIT' ? 429 : 502).json({ error: error.message })
  }
}
