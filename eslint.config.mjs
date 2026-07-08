// Configuração mínima da Fase 1 (raiz, resolvida por todos os workspaces).
// Na Fase 2 a configuração é centralizada em packages/config/eslint.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
