-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "invitationId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "OrganizationInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Grant permissions to app_user
GRANT ALL ON "Notification" TO app_user;

-- Enable and force Row Level Security on Notification
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;

-- User Isolation Policy for Notification
CREATE POLICY "notification_user_isolation" ON "Notification"
FOR ALL
TO app_user
USING ("userId" = current_setting('app.current_user_id', TRUE))
WITH CHECK ("userId" = current_setting('app.current_user_id', TRUE));

-- Update OrganizationInvitation RLS policies
DROP POLICY IF EXISTS "tenant_isolation" ON "OrganizationInvitation";

-- 1. Tenant Members full policy (read and write scoped to tenant)
CREATE POLICY "invitation_tenant_isolation" ON "OrganizationInvitation"
FOR ALL
TO app_user
USING ("organizationId" = current_setting('app.current_tenant_id', TRUE))
WITH CHECK ("organizationId" = current_setting('app.current_tenant_id', TRUE));

-- 2. Recipient SELECT Policy (read-only for non-member recipient matching session email)
CREATE POLICY "invitation_recipient_select" ON "OrganizationInvitation"
FOR SELECT
TO app_user
USING ("email" = current_setting('app.current_user_email', TRUE));
