GRANT ALL ON "Subscription" TO app_user;
GRANT ALL ON "StripeEvent" TO app_user;

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;

CREATE POLICY subscription_tenant_isolation ON "Subscription"
  USING ("organizationId" = current_setting('app.current_tenant_id', TRUE)::text);