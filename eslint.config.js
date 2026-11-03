// @ts-check
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      'packages/db/drizzle/**',
      'apps/app/src/components/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
      globals: globals.browser,
    },
  },
  {
    files: [
      'apps/api/**',
      'apps/worker/**',
      'packages/**',
      '*.config.{js,ts}',
      '**/*.config.{js,ts}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // Dependency direction (AGENTS.md): the browser app only talks to the API through the contract.
    files: ['apps/app/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@linear/db*',
                '@linear/core*',
                '@linear/queue*',
                '@linear/storage*',
                '@linear/env*',
              ],
              message: 'apps/app may only import @linear/contract.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@linear/queue*', '@linear/storage*', '@linear/contract*', '@linear/env*'],
              message: 'core may only import @linear/db.',
            },
          ],
        },
      ],
    },
  },
  {
    // The API may start the real worker in tests (apps/api/test/acceptance), never at runtime.
    files: ['apps/api/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@linear/worker*'], message: 'apps/api must not import the worker.' }],
        },
      ],
    },
  },
  prettier,
)
