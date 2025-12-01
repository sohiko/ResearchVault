import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@/pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@/hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@/utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@/styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: true,
    open: true,
    // API プロキシは削除（Vercel の serverless functions を使用するため）
    // 開発環境では Vercel CLI を使用して API を実行するか、
    // または直接 API ルートにアクセスする
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // ビルド速度を向上させるため false に変更（必要に応じて true に戻す）
    minify: 'esbuild', // esbuild を使用してビルド速度を向上
    // 大きなライブラリの処理を最適化
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // node_modules のライブラリをチャンクに分離
          if (id.includes('node_modules')) {
            if (id.includes('pdfjs-dist')) {
              return 'pdfjs'
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor'
            }
            if (id.includes('react-router')) {
              return 'router'
            }
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            if (id.includes('@headlessui') || id.includes('@heroicons') || id.includes('framer-motion')) {
              return 'ui'
            }
            // その他の node_modules は vendor に
            return 'vendor'
          }
        },
      },
    },
    // チャンクサイズの警告を無効化（大きなライブラリがあるため）
    chunkSizeWarningLimit: 1000,
  },
  define: {
    // 本番環境でのconsole.logを削除
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
    ],
    // 大きなライブラリを除外してビルド速度を向上
    exclude: [
      'tesseract.js', // Tesseract.js は動的インポートなので除外
      'pdfjs-dist', // pdfjs-dist も動的インポートなので除外
    ],
    // フォース最適化を無効化（初回ビルドを高速化）
    force: false,
  },
})
