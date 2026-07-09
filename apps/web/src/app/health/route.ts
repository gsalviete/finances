/** Healthcheck do container (compose) — GET /health. */
export function GET(): Response {
  return Response.json({ status: 'ok', app: 'finances-web' });
}
