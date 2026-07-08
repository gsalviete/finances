// ESLint compartilhado do monorepo (flat config, ESLint 9).
// Consumido pelo eslint.config.mjs da raiz — os workspaces herdam automaticamente
// (o flat config é resolvido subindo a árvore de diretórios).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md §3: sem `any` sem justificativa (exceções via eslint-disable comentado).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Desativa regras que conflitam com o Prettier. Sempre por último.
  prettier,
);
