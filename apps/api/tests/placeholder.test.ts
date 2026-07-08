// Placeholder da Fase 1: garante que o runner está configurado.
import { APP_NAME } from '../src/main';

describe('@finances/api (stub)', () => {
  it('expõe o nome da aplicação', () => {
    expect(APP_NAME).toBe('finances-api');
  });
});
