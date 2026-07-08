# docker/

Ambiente de containers do projeto (MongoDB, Mongo Express, API, WEB).

**Fase 1:** apenas a estrutura do diretório. O `docker-compose.yml` com healthchecks,
volumes persistentes e restart automático é entregue na **Fase 4** do
`docs/IMPLEMENTATION_ROADMAP.md`. Os `Dockerfile` de cada app vivem junto do
respectivo app (`apps/api`, `apps/web`), conforme `docs/MONOREPO_STRUCTURE.md §6`.
