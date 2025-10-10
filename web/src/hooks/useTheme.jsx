import React, { createContext, useContext, useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

// テーマコンテキストの作成
const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  systemTheme: 'light',
  isSystemTheme: false
})

// テーマプロバイダーコンポーネント
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')
  const [systemTheme, setSystemTheme] = useState('light')
  const [isSystemTheme, setIsSystemTheme] = useState(false)

  // システムのテーマ設定を監視
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    
    // 初期値を設定
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    
    // 変更を監視
    mediaQuery.addEventListener('change', handleChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  // 保存されたテーマ設定を読み込み
  useEffect(() => {
    const savedTheme = localStorage.getItem('researchvault-theme')
    const savedIsSystemTheme = localStorage.getItem('researchvault-use-system-theme') === 'true'
    
    if (savedIsSystemTheme) {
      setIsSystemTheme(true)
      setThemeState(systemTheme)
    } else if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
      setThemeState(savedTheme)
      setIsSystemTheme(false)
    } else {
      // デフォルトはシステムテーマに従う
      setIsSystemTheme(true)
      setThemeState(systemTheme)
      localStorage.setItem('researchvault-use-system-theme', 'true')
    }
  }, [systemTheme])

  // テーマの変更をDOMに適用
  useEffect(() => {
    const root = document.documentElement
    
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    // カスタムプロパティの設定
    root.style.setProperty('--theme', theme)
    
    // メタテーマカラーの更新
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.content = theme === 'dark' ? '#1f2937' : '#3b82f6'
    }
  }, [theme])

  // システムテーマが変更された場合の処理
  useEffect(() => {
    if (isSystemTheme) {
      setThemeState(systemTheme)
    }
  }, [systemTheme, isSystemTheme])

  // テーマの設定
  const setTheme = (newTheme) => {
    if (newTheme === 'system') {
      setIsSystemTheme(true)
      setThemeState(systemTheme)
      localStorage.setItem('researchvault-use-system-theme', 'true')
      localStorage.removeItem('researchvault-theme')
    } else if (['light', 'dark'].includes(newTheme)) {
      setIsSystemTheme(false)
      setThemeState(newTheme)
      localStorage.setItem('researchvault-theme', newTheme)
      localStorage.setItem('researchvault-use-system-theme', 'false')
    }
  }

  // テーマの切り替え
  const toggleTheme = () => {
    if (isSystemTheme) {
      // システムテーマから手動テーマに切り替え
      const newTheme = systemTheme === 'dark' ? 'light' : 'dark'
      setTheme(newTheme)
    } else {
      // 手動テーマの切り替え
      const newTheme = theme === 'dark' ? 'light' : 'dark'
      setTheme(newTheme)
    }
  }

  // 現在のテーマの取得
  const getCurrentTheme = () => {
    if (isSystemTheme) {return 'system'}
    return theme
  }

  // テーマアイコンの取得
  const getThemeIcon = () => {
    if (isSystemTheme) {
      return <Monitor className="w-5 h-5" />
    }
    return theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />
  }

  // テーマ名の取得
  const getThemeName = () => {
    if (isSystemTheme) {return 'システム'}
    return theme === 'dark' ? 'ダークモード' : 'ライトモード'
  }

  // CSSカスタムプロパティの取得
  const getCSSVariables = () => {
    return {
      '--theme-primary': theme === 'dark' ? '#3b82f6' : '#2563eb',
      '--theme-secondary': theme === 'dark' ? '#64748b' : '#475569',
      '--theme-background': theme === 'dark' ? '#0f172a' : '#ffffff',
      '--theme-surface': theme === 'dark' ? '#1e293b' : '#f8fafc',
      '--theme-text-primary': theme === 'dark' ? '#f1f5f9' : '#1f2937',
      '--theme-text-secondary': theme === 'dark' ? '#cbd5e1' : '#6b7280',
      '--theme-border': theme === 'dark' ? '#374151' : '#e5e7eb',
      '--theme-shadow': theme === 'dark' 
        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' 
        : '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }
  }

  // テーマごとの色の取得
  const getColors = () => {
    const baseColors = {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe', 
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a'
      },
      secondary: theme === 'dark' ? {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a'
      } : {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a'
      }
    }
    
    return baseColors
  }

  // メディアクエリフック
  const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(false)
    
    useEffect(() => {
      const media = window.matchMedia(query)
      if (media.matches !== matches) {
        setMatches(media.matches)
      }
      
      const listener = () => setMatches(media.matches)
      media.addEventListener('change', listener)
      
      return () => media.removeEventListener('change', listener)
    }, [matches, query])
    
    return matches
  }

  // プリセットテーマの定義
  const presetThemes = [
    {
      id: 'light',
      name: 'ライトモード',
      icon: <Sun className="w-6 h-6" />,
      colors: {
        background: '#ffffff',
        surface: '#f8fafc',
        primary: '#2563eb',
        text: '#1f2937'
      }
    },
    {
      id: 'dark',
      name: 'ダークモード', 
      icon: <Moon className="w-6 h-6" />,
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        primary: '#3b82f6',
        text: '#f1f5f9'
      }
    },
    {
      id: 'system',
      name: 'システム',
      icon: <Monitor className="w-6 h-6" />,
      description: 'OSの設定に従います'
    }
  ]

  const value = {
    theme,
    setTheme,
    toggleTheme,
    systemTheme,
    isSystemTheme,
    getCurrentTheme,
    getThemeIcon,
    getThemeName,
    getCSSVariables,
    getColors,
    presetThemes,
    useMediaQuery
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// カスタムフック
export function useTheme() {
  const context = useContext(ThemeContext)
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  
  return context
}

// テーマ切り替えボタンコンポーネント
export function ThemeToggle({ className = '' }) {
  const { toggleTheme, getThemeIcon, getThemeName } = useTheme()
  
  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 transition-colors duration-200 ${className}`}
      title={`現在: ${getThemeName()}`}
      aria-label="テーマを切り替え"
    >
      {getThemeIcon()}
    </button>
  )
}

// テーマセレクターコンポーネント
export function ThemeSelector({ className = '' }) {
  const { getCurrentTheme, setTheme, presetThemes } = useTheme()
  const currentTheme = getCurrentTheme()
  
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
        テーマ
      </label>
      <div className="grid grid-cols-3 gap-2">
        {presetThemes.map((preset) => (
          <button
            key={preset.id}
            onClick={() => setTheme(preset.id)}
            className={`p-3 rounded-lg border text-center transition-all duration-200 ${
              currentTheme === preset.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-secondary-200 hover:border-secondary-300 dark:border-secondary-700 dark:hover:border-secondary-600'
            }`}
          >
            <div className="flex justify-center mb-1">{preset.icon}</div>
            <div className="text-xs font-medium">{preset.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default useTheme
