# infra/docker

Local development infrastructure. Currently just PostgreSQL, matching the
two-role setup described in
[`../../docs/architecture/multi-tenancy.md`](../../docs/architecture/multi-tenancy.md):

- `dos_migrator` — the container's Postgres superuser (`POSTGRES_USER`),
  used only by `prisma migrate`.
- `dos_app` — a restricted role with no `BYPASSRLS`, created by `init.sql`
  on first boot, used by the running API (`DATABASE_URL` in
  `apps/api/.env.example`).

## Usage

```bash
docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml down        # stop
docker compose -f infra/docker/docker-compose.yml down -v     # stop + wipe data
```

`init.sql` only runs on the container's **first** boot (Postgres image
convention) — if you change it, `down -v` and `up -d` again to re-init.
