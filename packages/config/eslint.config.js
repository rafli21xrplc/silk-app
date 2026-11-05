import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Konfigurasi ESLint bersama untuk paket TypeScript SILK. */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/drizzle/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
);
