-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_organizationId_fkey";

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update prevent_audit_log_mutation function to allow scoped deletion during organization destruction
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('app.allow_organization_deletion', TRUE) = 'true' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'AuditLog records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;
