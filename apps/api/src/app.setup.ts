import type { INestApplication } from '@nestjs/common';

/**
 * Configuração comum ao bootstrap real e aos testes e2e — garante que os testes
 * exercitam exatamente o mesmo app (prefixo /api/v1 obrigatório — ARCHITECTURE §3).
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
}
