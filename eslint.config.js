import globals from 'globals';
import tseslint from 'typescript-eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import eslint from '@eslint/js';

export default tseslint.config(
  // グローバルな無視設定
  {
    ignores: ['dist/', 'node_modules/', 'playwright-report/', 'coverage/', 'tests/', '*.cjs'],
  },

  // ESLintの推奨設定
  eslint.configs.recommended,

  // TypeScriptの推奨設定
  ...tseslint.configs.recommended,

  // Svelteの推奨設定 (フラット形式)
  ...sveltePlugin.configs['flat/recommended'],

  // プロジェクト全体の設定
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Svelteファイルの上書き設定
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
);