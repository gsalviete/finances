// Silencia logs de requisição durante os testes (roda antes de qualquer import).
process.env.LOG_LEVEL = 'fatal';
process.env.NODE_ENV = 'test';
