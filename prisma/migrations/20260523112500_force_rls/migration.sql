-- Without FORCE, Postgres exempts the table owner from RLS. The app connects
-- as the owner role in this MVP, so we must FORCE policies to apply to it too.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','managers','farms','farm_managers','seasons','categories',
    'expenses','revenues','activities','attachments',
    'wa_inbound_messages','wa_outbound_messages','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END$$;
