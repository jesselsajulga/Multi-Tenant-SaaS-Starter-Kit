GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL ON "Project" TO app_user;

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;

CREATE POLICY project_tenant_isolation ON "Project"
  USING ("organizationId" = current_setting('app.current_tenant_id', TRUE));