// Stub HTTP da Fase 4: expõe apenas GET /health para os healthchecks do compose.
// O frontend real (Next.js App Router, tokens, temas) é entregue na Fase 19
// do IMPLEMENTATION_ROADMAP.md. Nenhuma UI ou regra de negócio aqui.
import { createServer, type Server } from 'node:http';

export const APP_NAME = 'finances-web';

export function createApp(): Server {
  return createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', app: APP_NAME }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`[${APP_NAME}] stub da Fase 4 — frontend real a partir da Fase 19.\n`);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => {
    console.log(`[${APP_NAME}] stub ouvindo em :${port} (GET /health) — frontend real na Fase 19.`);
  });
}
