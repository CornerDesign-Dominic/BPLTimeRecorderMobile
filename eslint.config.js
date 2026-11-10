import js from '@eslint/js'
import globals from 'globals'
export default [{ ignores: ['dist/**', 'node_modules/**'] }, { files: ['**/*.{js,jsx}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node, ...globals.serviceworker }, parserOptions: { ecmaFeatures: { jsx: true } } }, rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }] } }]
