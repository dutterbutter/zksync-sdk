import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Flat-config array */
export default [
  /* plain JS rules */
  js.configs.recommended,

  /* TS-ESLint core & type-checked rules */
  ...tseslint.configs.recommendedTypeChecked,

  /* our project-specific layer */
  {
    files: ['**/*.ts', '**/*.tsx'],

    languageOptions: {
      parserOptions: {
        /* ①  use the dedicated lint tsconfig */
        project: ['./tsconfig.eslint.json'],
      },
    },

    rules: {
      'no-console': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
    },

    /* ②  Ignore build artefacts everywhere */
    ignores: ['**/dist/**', '**/node_modules/**', 'examples/**', 'scripts/**'],
  },
];
