// Ambiente dos testes (roda antes de qualquer import).
process.env.LOG_LEVEL = 'fatal';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-exclusivo-de-teste-com-32+chars!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.RATE_LIMIT_MAX = '10000'; // e2e martelam a API de propósito
