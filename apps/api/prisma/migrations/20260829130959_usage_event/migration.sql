-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_metric_idx" ON "UsageEvent"("organizationId", "metric");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_timestamp_idx" ON "UsageEvent"("organizationId", "timestamp");

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row-Level Security
ALTER TABLE "UsageEvent" ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy for Tenant Isolation
CREATE POLICY "tenant_isolation" ON "UsageEvent"
    AS PERMISSIVE FOR ALL
    TO app_user
    USING ("organizationId" = current_setting('app.current_tenant_id', true));

-- Grant permissions to restricted role
GRANT SELECT, INSERT ON "UsageEvent" TO app_user;

-- Create Immutability Trigger for UPDATE (DELETE omitted to see if Cascade works or if we must add it)
CREATE OR REPLACE FUNCTION prevent_usage_event_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'UsageEvent is an immutable ledger. Updates are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_usage_event_update
    BEFORE UPDATE ON "UsageEvent"
    FOR EACH ROW
    EXECUTE FUNCTION prevent_usage_event_update();
