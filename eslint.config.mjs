import prettierConfig from 'eslint-config-prettier'

export default [
  {
    languageOptions: {
      ecmaVersion: 11,
      sourceType: 'module'
    },
    rules: {
      'no-useless-escape': 0
    }
  },
  prettierConfig
]
