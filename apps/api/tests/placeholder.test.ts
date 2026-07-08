// Placeholder da Fase 4: valida o stub de /health usado pelos healthchecks do compose.
import type { AddressInfo } from 'node:net';
import { APP_NAME, createApp } from '../src/main';

describe('@finances/api (stub)', () => {
  it('expõe o nome da aplicação', () => {
    expect(APP_NAME).toBe('finances-api');
  });

  it('responde 200 em GET /health', async () => {
    const server = createApp().listen(0);
    const { port } = server.address() as AddressInfo;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ status: 'ok', app: APP_NAME });
    } finally {
      server.close();
    }
  });
});
