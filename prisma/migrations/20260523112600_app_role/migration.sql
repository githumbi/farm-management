-- Create a non-superuser role that the app uses at runtime.
-- Migrations still run as the owner (DATABASE_URL); the app connects as
-- this role (DATABASE_APP_URL) so RLS policies are enforced.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shamba_app') THEN
    CREATE ROLE shamba_app LOGIN PASSWORD 'shamba_app' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO shamba_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shamba_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO shamba_app;

-- Future tables/sequences created by migrations should also be accessible.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shamba_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO shamba_app;
