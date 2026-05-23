-- Partial unique indexes (PRD §11.4)
CREATE UNIQUE INDEX one_active_manager_per_farm
  ON farm_managers (farm_id) WHERE unassigned_at IS NULL;

CREATE UNIQUE INDEX one_active_season_per_farm
  ON seasons (farm_id) WHERE status = 'active';

-- Row-level security on tenant-scoped tables.
-- `app.tenant_id` is set as a session/transaction GUC by lib/db.ts:withTenant.
-- `tenant_id IS NULL` is allowed so system-default categories (and unrouted
-- wa_inbound_messages) remain visible.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','managers','farms','seasons','categories',
    'expenses','revenues','activities','attachments',
    'wa_inbound_messages','wa_outbound_messages','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
    $f$, t);
  END LOOP;
END$$;

-- farm_managers has no tenant_id column — isolation is inherited from the
-- parent farm. The nested SELECT respects the RLS policy on `farms`, so the
-- EXISTS check naturally filters by the current tenant.
ALTER TABLE farm_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON farm_managers
  USING (
    EXISTS (
      SELECT 1 FROM farms f
      WHERE f.id = farm_managers.farm_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM farms f
      WHERE f.id = farm_managers.farm_id
    )
  );
