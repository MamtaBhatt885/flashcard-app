// ESLint flat config for the whole monorepo (run `npm run lint` from the root).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Build output, generated code, reports and dependencies are never linted.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/src/generated/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Rules for all TypeScript files.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Unused variables are errors, except ones deliberately prefixed with _ (e.g. `_next`).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `import type` keeps type-only imports out of the JavaScript output.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Backend, shared package, scripts and config files run in Node.
  {
    files: ['apps/api/**/*.{ts,js,mjs}', 'packages/shared/**/*.ts', '**/*.config.{ts,js}', 'apps/web/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Frontend runs in the browser and uses React hooks.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Tests may use non-null assertions on values they've just checked.
  {
    files: ['**/*.test.{ts,tsx}', '**/e2e/**/*.ts', '**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  // Must be last: turns off formatting rules that Prettier handles.
  prettier,
);
