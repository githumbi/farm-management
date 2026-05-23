-- Make RLS policies resilient to an unset/empty `app.tenant_id`.
-- After a transaction-local `set_config` reverts, Postgres can leave the
-- custom GUC registered with an empty string, and `""::uuid` errors.
-- Wrap in NULLIF so empty-string → NULL → policy denies (or allows the
-- IS NULL branch for system defaults).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','managers','farms','seasons','categories',
    'expenses','revenues','activities','attachments',
    'wa_inbound_messages','wa_outbound_messages','audit_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (
          tenant_id IS NULL
          OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
        WITH CHECK (
          tenant_id IS NULL
          OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
        )
    $f$, t);
  END LOOP;
END$$;
