// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // 0) Global ignores (put FIRST so they apply to this file too)
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'examples/**', 'scripts/**', 'eslint.config.mjs'],
  },

  // 1) Plain JS baseline
  js.configs.recommended,

  // 2) Type-checked TS rules (scoped to TS files, with project config)
  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ...cfg.languageOptions,
      parserOptions: {
        ...(cfg.languageOptions?.parserOptions ?? {}),
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: new URL('.', import.meta.url),
      },
    },
  })),

  // 3) Project-specific tweaks
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
];
