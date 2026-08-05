-- Runs once, on first container boot (postgres image convention: any
-- *.sql file in /docker-entrypoint-initdb.d/ is executed against the
-- database named by POSTGRES_DB). Creates the restricted `dos_app` role
-- that the running API connects as — see docs/architecture/multi-tenancy.md
-- for why two roles exist and what each is allowed to do.
--
-- `dos_migrator` (POSTGRES_USER, a superuser) is created automatically by
-- the postgres image itself and needs no statements here.

CREATE ROLE dos_app WITH LOGIN PASSWORD 'dos_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT CONNECT ON DATABASE dos TO dos_app;
GRANT USAGE ON SCHEMA public TO dos_app;

-- Every table/sequence Prisma creates after this point (via dos_migrator,
-- which owns them) must remain readable/writable by dos_app, or every
-- future migration would need to re-grant by hand. ALTER DEFAULT
-- PRIVILEGES makes the grant apply automatically to objects created later
-- by dos_migrator in this schema.
ALTER DEFAULT PRIVILEGES FOR ROLE dos_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE dos_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO dos_app;
