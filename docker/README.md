# docker/

Ambiente de containers do projeto (MongoDB, Mongo Express, API, WEB).

**Estado (Fase 3):** os `Dockerfile` de cada app existem junto do respectivo app
(`apps/api`, `apps/web`), conforme `docs/MONOREPO_STRUCTURE.md §6`, e são validados
no CI (`docker build` com contexto na raiz do monorepo). O `docker-compose.yml` com
MongoDB, Mongo Express, healthchecks, volumes persistentes e restart automático é
entregue na **Fase 4** do `docs/IMPLEMENTATION_ROADMAP.md`.
