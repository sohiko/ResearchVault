/**
 * VPS / 自前ホスティング用の本番サーバー。
 * Vite の静的ファイル (dist/) と web/api/ の Vercel 形式ハンドラを提供する。
 */
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const DIST_DIR = process.env.DIST_DIR || path.join(__dirname, 'dist')

/** @type {Map<string, (req: import('express').Request, res: import('express').Response) => Promise<void>>} */
const handlerCache = new Map()

async function loadHandler(modulePath) {
  if (handlerCache.has(modulePath)) {
    return handlerCache.get(modulePath)
  }
  const mod = await import(modulePath)
  const handler = mod.default
  handlerCache.set(modulePath, handler)
  return handler
}

function createApiHandler(modulePath, mergeQuery) {
  return async (req, res, next) => {
    try {
      const handler = await loadHandler(modulePath)
      if (mergeQuery) {
        Object.assign(req.query, mergeQuery(req))
      }
      await handler(req, res)
    } catch (error) {
      next(error)
    }
  }
}

async function preloadApiHandlers() {
  // 文献作成で使う重いモジュールを起動時に読み込む（初回リクエストの14秒遅延を防ぐ）
  const criticalModules = [
    './api/health.js',
    './api/reference-info.js',
    './api/pdf-proxy.js',
    './api/extension.js',
  ]
  console.log('[server] Preloading critical API handlers...')
  await Promise.all(criticalModules.map((p) => loadHandler(p)))
  console.log('[server] Critical API handlers ready')
}

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// vercel.json の rewrites に相当するルート
app.all('/api/auth/login', createApiHandler('./api/auth.js', () => ({ action: 'login' })))
app.all('/api/auth/signup', createApiHandler('./api/auth.js', () => ({ action: 'signup' })))
app.all('/api/extension/auth', createApiHandler('./api/extension.js', () => ({ action: 'auth' })))
app.all('/api/extension/health', createApiHandler('./api/extension.js', () => ({ action: 'health' })))
app.all('/api/extension/refresh', createApiHandler('./api/extension.js', () => ({ action: 'refresh' })))

const apiRoutes = [
  ['/api/health', './api/health.js'],
  ['/api/reference-info', './api/reference-info.js'],
  ['/api/pdf-proxy', './api/pdf-proxy.js'],
  ['/api/auth', './api/auth.js'],
  ['/api/extension', './api/extension.js'],
  ['/api/projects', './api/projects.js'],
  ['/api/invitations', './api/invitations.js'],
  ['/api/references', './api/references.js'],
  ['/api/candidates', './api/candidates.js'],
  ['/api/selected-texts', './api/selected-texts.js'],
  ['/api/citations/generate', './api/citations/generate.js'],
]

for (const [route, modulePath] of apiRoutes) {
  app.all(route, createApiHandler(modulePath))
}

app.all('/api/projects/:id', createApiHandler('./api/projects/[id].js', (req) => ({
  id: req.params.id
})))

app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled API error:', err)
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false }))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
} else {
  console.warn(`[server] dist/ not found at ${DIST_DIR}. Run "npm run build" before starting.`)
}

await preloadApiHandlers()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] ResearchVault listening on http://0.0.0.0:${PORT}`)
  console.log(`[server] Static: ${fs.existsSync(DIST_DIR) ? DIST_DIR : '(missing)'}`)
})
