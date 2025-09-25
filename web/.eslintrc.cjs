module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    'react',
    'react-hooks',
    'react-refresh'
  ],
  rules: {
    // React関連
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': 'warn',
    
    // 一般的なルール（緩和）
    'no-console': 'off', // 開発中はconsole.logを許可
    'no-debugger': 'error',
    'no-alert': 'warn',
    'no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^React$' // React変数を許可
    }],
    
    // インポート/エクスポート
    'no-duplicate-imports': 'error',
    
    // コードスタイル（緩和）
    'prefer-const': 'error',
    'no-var': 'error',
    
    // ES6+（緩和）
    'arrow-spacing': 'warn',
    'no-useless-constructor': 'warn',
    'object-shorthand': 'warn',
    
    // その他（緩和）
    'eqeqeq': ['warn', 'always'],
    'curly': ['warn', 'all']
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}
