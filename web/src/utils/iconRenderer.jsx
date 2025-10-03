import React from 'react'
import {
  Folder,
  BookOpen,
  Microscope,
  BarChart3,
  Target,
  Search,
  FileText,
  Lightbulb,
  FlaskConical,
  Clipboard,
  Briefcase,
  GraduationCap,
  Atom,
  Calculator,
  Globe,
  Heart,
  Music,
  Palette,
  Camera,
  Code,
  Database,
  Cpu,
  Zap,
  Rocket,
  Star
} from 'lucide-react'

// Lucideアイコンのマッピング
export const lucideIconMap = {
  Folder,
  BookOpen,
  Microscope,
  BarChart3,
  Target,
  Search,
  FileText,
  Lightbulb,
  FlaskConical,
  Clipboard,
  Briefcase,
  GraduationCap,
  Atom,
  Calculator,
  Globe,
  Heart,
  Music,
  Palette,
  Camera,
  Code,
  Database,
  Cpu,
  Zap,
  Rocket,
  Star
}

/**
 * アイコン文字列からタイプとアイコン名を判定する関数
 * @param {string} iconString - アイコン文字列
 * @returns {Object} { type, name }
 */
const parseIconString = (iconString) => {
  if (!iconString) {
    return { type: 'emoji', name: '📂' }
  }
  
  // "lucide:" プレフィックスがある場合はLucideアイコン
  if (iconString.startsWith('lucide:')) {
    return { type: 'lucide', name: iconString.replace('lucide:', '') }
  }
  
  // Lucideアイコン名として認識される場合
  if (lucideIconMap[iconString]) {
    return { type: 'lucide', name: iconString }
  }
  
  // それ以外は絵文字として扱う
  return { type: 'emoji', name: iconString }
}

/**
 * プロジェクトアイコンをレンダリングする関数
 * @param {string} icon - アイコン名または絵文字
 * @param {string} iconType - 'lucide' または 'emoji' (省略可能、自動判定)
 * @param {string} className - CSSクラス名
 * @returns {JSX.Element} レンダリングされたアイコン
 */
export const renderProjectIcon = (icon, iconType = null, className = 'w-5 h-5') => {
  // iconTypeが指定されていない場合は自動判定
  const { type, name } = iconType ? { type: iconType, name: icon } : parseIconString(icon)
  
  // Lucideアイコンの場合
  if (type === 'lucide') {
    const IconComponent = lucideIconMap[name]
    if (IconComponent) {
      return <IconComponent className={className} />
    }
  }
  
  // 絵文字またはフォールバック
  return <span className="text-lg">{name || '📂'}</span>
}

/**
 * 利用可能なLucideアイコンの一覧を取得
 * @returns {Array} アイコンデータの配列
 */
export const getAvailableLucideIcons = () => {
  return [
    { name: 'Folder', component: Folder, label: 'フォルダ' },
    { name: 'BookOpen', component: BookOpen, label: '本' },
    { name: 'Microscope', component: Microscope, label: '顕微鏡' },
    { name: 'BarChart3', component: BarChart3, label: 'グラフ' },
    { name: 'Target', component: Target, label: 'ターゲット' },
    { name: 'Search', component: Search, label: '検索' },
    { name: 'FileText', component: FileText, label: 'ドキュメント' },
    { name: 'Lightbulb', component: Lightbulb, label: 'アイデア' },
    { name: 'FlaskConical', component: FlaskConical, label: '実験' },
    { name: 'Clipboard', component: Clipboard, label: 'クリップボード' },
    { name: 'Briefcase', component: Briefcase, label: 'ビジネス' },
    { name: 'GraduationCap', component: GraduationCap, label: '教育' },
    { name: 'Atom', component: Atom, label: '原子' },
    { name: 'Calculator', component: Calculator, label: '計算機' },
    { name: 'Globe', component: Globe, label: '地球' },
    { name: 'Heart', component: Heart, label: 'ハート' },
    { name: 'Music', component: Music, label: '音楽' },
    { name: 'Palette', component: Palette, label: 'パレット' },
    { name: 'Camera', component: Camera, label: 'カメラ' },
    { name: 'Code', component: Code, label: 'コード' },
    { name: 'Database', component: Database, label: 'データベース' },
    { name: 'Cpu', component: Cpu, label: 'CPU' },
    { name: 'Zap', component: Zap, label: '稲妻' },
    { name: 'Rocket', component: Rocket, label: 'ロケット' },
    { name: 'Star', component: Star, label: '星' }
  ]
}

/**
 * 利用可能な絵文字アイコンの一覧を取得
 * @returns {Array} 絵文字データの配列
 */
export const getAvailableEmojiIcons = () => {
  return [
    { name: '📂', label: 'フォルダ' },
    { name: '📚', label: '本' },
    { name: '🔬', label: '顕微鏡' },
    { name: '📊', label: 'グラフ' },
    { name: '🎯', label: 'ターゲット' },
    { name: '🔍', label: '検索' },
    { name: '📝', label: 'メモ' },
    { name: '💡', label: 'アイデア' },
    { name: '🧪', label: '実験' },
    { name: '📋', label: 'クリップボード' },
    { name: '💼', label: 'ビジネス' },
    { name: '🎓', label: '教育' },
    { name: '⚛️', label: '原子' },
    { name: '🧮', label: '計算機' },
    { name: '🌍', label: '地球' },
    { name: '❤️', label: 'ハート' },
    { name: '🎵', label: '音楽' },
    { name: '🎨', label: 'アート' },
    { name: '📷', label: 'カメラ' },
    { name: '💻', label: 'コンピュータ' },
    { name: '🗄️', label: 'データベース' },
    { name: '⚡', label: '稲妻' },
    { name: '🚀', label: 'ロケット' },
    { name: '⭐', label: '星' }
  ]
}
