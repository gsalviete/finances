// Stub HTTP da Fase 4: expõe apenas GET /health para os healthchecks do compose.
// O bootstrap real (NestJS, Pino, Swagger, filtro de erros, health/readiness/liveness)
// é entregue na Fase 7 do IMPLEMENTATION_ROADMAP.md. Nenhuma regra de negócio aqui.
import { createServer, type Server } from 'node:http';

export const APP_NAME = 'finances-api';

export function createApp(): Server {
  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', app: APP_NAME }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { message: 'Not Found', code: 'NOT_FOUND' } }));
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3001);
  createApp().listen(port, () => {
    console.log(`[${APP_NAME}] stub ouvindo em :${port} (GET /health) — API real na Fase 7.`);
  });
}
