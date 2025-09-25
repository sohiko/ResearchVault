// ヘルスチェックAPIエンドポイント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pzplwtvnxikhykqsvcfs.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGx3dHZueGlraHlrcXN2Y2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NTg3NzQsImV4cCI6MjA3NDMzNDc3NH0.k8h6E0QlW2549ILvrR5NeMdzJMmhmekj6O_GZ3C43V0'

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let databaseStatus = false

    // Supabaseの接続チェック
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const { error } = await supabase.from('projects').select('id').limit(1)
        databaseStatus = !error
      } catch (dbError) {
        console.warn('Database health check failed:', dbError)
        databaseStatus = false
      }
    }

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      api: true,
      database: databaseStatus,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }

    return res.status(200).json(healthStatus)

  } catch (error) {
    console.error('Health check error:', error)
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      api: false,
      database: false,
      error: 'Internal server error'
    })
  }
}
