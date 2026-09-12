import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, getTenantPrisma } from '../src/db';
import { Pool } from 'pg';

describe('Database Row-Level Security (RLS) Isolation Suite', () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;

  let projectAId: string;
  let projectBId: string;

  let subscriptionAId: string;
  let subscriptionBId: string;

  let auditLogAId: string;
  let auditLogBId: string;

  let flagAId: string;
  let flagBId: string;

  let rawPool: Pool;

  beforeAll(async () => {
    rawPool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Seed baseline users and organizations using admin prisma
    const userA = await prisma.user.create({
      data: { email: `rls-user-a-${Date.now()}@example.com` },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: { email: `rls-user-b-${Date.now()}@example.com` },
    });
    userBId = userB.id;

    const orgA = await prisma.organization.create({
      data: {
        name: 'Tenant Org A',
        members: { create: { userId: userAId, role: 'OWNER' } },
      },
    });
    orgAId = orgA.id;

    const orgB = await prisma.organization.create({
      data: {
        name: 'Tenant Org B',
        members: { create: { userId: userBId, role: 'OWNER' } },
      },
    });
    orgBId = orgB.id;

    // Seed tenant records for Tenant A
    const tenantA = getTenantPrisma(orgAId);
    const pA = await tenantA.project.create({
      data: { name: 'Project Alpha', organizationId: orgAId },
    });
    projectAId = pA.id;

    const subA = await tenantA.subscription.create({
      data: {
        organizationId: orgAId,
        stripeCustomerId: `cus_A_${Date.now()}`,
        stripeSubscriptionId: `sub_A_${Date.now()}`,
        status: 'active',
        plan: 'pro',
      },
    });
    subscriptionAId = subA.id;

    const logA = await tenantA.auditLog.create({
      data: {
        organizationId: orgAId,
        actorId: userAId,
        action: 'PROJECT_CREATED',
        resourceType: 'Project',
        resourceId: projectAId,
      },
    });
    auditLogAId = logA.id;

    const flagA = await tenantA.featureFlag.create({
      data: {
        organizationId: orgAId,
        key: 'beta_feature_flag',
        enabled: true,
      },
    });
    flagAId = flagA.id;

    await tenantA.usageEvent.create({
      data: {
        organizationId: orgAId,
        metric: 'api_calls',
        quantity: 10,
      },
    });

    // Seed tenant records for Tenant B
    const tenantB = getTenantPrisma(orgBId);
    const pB = await tenantB.project.create({
      data: { name: 'Project Beta', organizationId: orgBId },
    });
    projectBId = pB.id;

    const subB = await tenantB.subscription.create({
      data: {
        organizationId: orgBId,
        stripeCustomerId: `cus_B_${Date.now()}`,
        stripeSubscriptionId: `sub_B_${Date.now()}`,
        status: 'active',
        plan: 'enterprise',
      },
    });
    subscriptionBId = subB.id;

    const logB = await tenantB.auditLog.create({
      data: {
        organizationId: orgBId,
        actorId: userBId,
        action: 'PROJECT_CREATED',
        resourceType: 'Project',
        resourceId: projectBId,
      },
    });
    auditLogBId = logB.id;

    const flagB = await tenantB.featureFlag.create({
      data: {
        organizationId: orgBId,
        key: 'beta_feature_flag',
        enabled: false,
      },
    });
    flagBId = flagB.id;

    await tenantB.usageEvent.create({
      data: {
        organizationId: orgBId,
        metric: 'api_calls',
        quantity: 25,
      },
    });
  });

  afterAll(async () => {
    // Clean up all test data with admin client
    await prisma.$executeRaw`ALTER TABLE "AuditLog" DISABLE TRIGGER trg_prevent_audit_log_mutation;`;
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.$executeRaw`ALTER TABLE "AuditLog" ENABLE TRIGGER trg_prevent_audit_log_mutation;`;

    await prisma.usageEvent.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.featureFlag.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.subscription.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.project.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });

    await rawPool.end();
  });

  describe('1. Model-by-Model Cross-Tenant Read Isolation', () => {
    it('Tenant A should see only Project A and never Project B', async () => {
      const tenantA = getTenantPrisma(orgAId);
      const projects = await tenantA.project.findMany();
      expect(projects.map((p) => p.id)).toContain(projectAId);
      expect(projects.map((p) => p.id)).not.toContain(projectBId);

      const crossRead = await tenantA.project.findUnique({ where: { id: projectBId } });
      expect(crossRead).toBeNull();
    });

    it('Tenant B should see only Project B and never Project A', async () => {
      const tenantB = getTenantPrisma(orgBId);
      const projects = await tenantB.project.findMany();
      expect(projects.map((p) => p.id)).toContain(projectBId);
      expect(projects.map((p) => p.id)).not.toContain(projectAId);

      const crossRead = await tenantB.project.findUnique({ where: { id: projectAId } });
      expect(crossRead).toBeNull();
    });

    it('Tenant A should see only Subscription A and never Subscription B', async () => {
      const tenantA = getTenantPrisma(orgAId);
      const subs = await tenantA.subscription.findMany();
      expect(subs.map((s) => s.id)).toContain(subscriptionAId);
      expect(subs.map((s) => s.id)).not.toContain(subscriptionBId);

      const crossRead = await tenantA.subscription.findUnique({ where: { id: subscriptionBId } });
      expect(crossRead).toBeNull();
    });

    it('Tenant A should see only AuditLog A and never AuditLog B', async () => {
      const tenantA = getTenantPrisma(orgAId);
      const logs = await tenantA.auditLog.findMany();
      expect(logs.map((l) => l.id)).toContain(auditLogAId);
      expect(logs.map((l) => l.id)).not.toContain(auditLogBId);

      const crossRead = await tenantA.auditLog.findUnique({ where: { id: auditLogBId } });
      expect(crossRead).toBeNull();
    });

    it('Tenant A should see only FeatureFlag A and never FeatureFlag B', async () => {
      const tenantA = getTenantPrisma(orgAId);
      const flags = await tenantA.featureFlag.findMany();
      expect(flags.map((f) => f.id)).toContain(flagAId);
      expect(flags.map((f) => f.id)).not.toContain(flagBId);

      const crossRead = await tenantA.featureFlag.findUnique({ where: { id: flagBId } });
      expect(crossRead).toBeNull();
    });

    it('Tenant A should see only UsageEvent A and never UsageEvent B', async () => {
      const tenantA = getTenantPrisma(orgAId);
      const events = await tenantA.usageEvent.findMany();
      expect(events.every((e) => e.organizationId === orgAId)).toBe(true);
      expect(events.some((e) => e.organizationId === orgBId)).toBe(false);
    });
  });

  describe('2. Cross-Tenant Write & Mutation Prevention', () => {
    it('Tenant A attempting to update Project B should affect 0 rows or throw', async () => {
      const tenantA = getTenantPrisma(orgAId);
      await expect(
        tenantA.project.update({
          where: { id: projectBId },
          data: { name: 'Hacked by Tenant A' },
        })
      ).rejects.toThrow();

      // Verify Project B name is unchanged
      const adminProjectB = await prisma.project.findUnique({ where: { id: projectBId } });
      expect(adminProjectB?.name).toBe('Project Beta');
    });

    it('Tenant A attempting to delete Project B should affect 0 rows or throw', async () => {
      const tenantA = getTenantPrisma(orgAId);
      await expect(
        tenantA.project.delete({
          where: { id: projectBId },
        })
      ).rejects.toThrow();

      // Verify Project B still exists
      const adminProjectB = await prisma.project.findUnique({ where: { id: projectBId } });
      expect(adminProjectB).not.toBeNull();
    });

    it('Tenant A attempting to insert a Project with organizationId = orgBId must be blocked by RLS', async () => {
      const tenantA = getTenantPrisma(orgAId);
      // RLS policy check on Project uses USING ("organizationId" = current_setting('app.current_tenant_id', true))
      await expect(
        tenantA.project.create({
          data: {
            name: 'Spoofed Tenant Project',
            organizationId: orgBId,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('3. Null / Missing Tenant Context Defense', () => {
    it('Raw connection running as app_user with empty/unset app.current_tenant_id sees 0 tenant records', async () => {
      const client = await rawPool.connect();
      try {
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        // No tenant set (or empty string)
        await client.query("SELECT set_config('app.current_tenant_id', '', TRUE);");

        const projects = await client.query('SELECT * FROM "Project";');
        expect(projects.rows.length).toBe(0);

        const subscriptions = await client.query('SELECT * FROM "Subscription";');
        expect(subscriptions.rows.length).toBe(0);

        const auditLogs = await client.query('SELECT * FROM "AuditLog";');
        expect(auditLogs.rows.length).toBe(0);

        const featureFlags = await client.query('SELECT * FROM "FeatureFlag";');
        expect(featureFlags.rows.length).toBe(0);

        await client.query('ROLLBACK;');
      } finally {
        client.release();
      }
    });
  });

  describe('4. Connection Pool Reuse Hygiene & Scope Leakage Test', () => {
    it('Reusing the exact same PostgreSQL connection across transactions must not leak tenant context or role', async () => {
      const client = await rawPool.connect();
      try {
        // --- Transaction 1: Tenant A ---
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        await client.query(`SELECT set_config('app.current_tenant_id', '${orgAId}', TRUE);`);

        const res1 = await client.query('SELECT id FROM "Project";');
        expect(res1.rows.map((r: any) => r.id)).toEqual([projectAId]);

        await client.query('COMMIT;');

        // Verify post-commit state: role should revert to session user (postgres/root), not app_user
        const roleAfterCommit = await client.query('SELECT current_user;');
        expect(roleAfterCommit.rows[0].current_user).not.toBe('app_user');

        // Verify setting has cleared or reverted
        const settingAfterCommit = await client.query("SELECT current_setting('app.current_tenant_id', true);");
        expect(settingAfterCommit.rows[0].current_setting).toBe('');

        // --- Transaction 2: Tenant B on the SAME connection ---
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        await client.query(`SELECT set_config('app.current_tenant_id', '${orgBId}', TRUE);`);

        const res2 = await client.query('SELECT id FROM "Project";');
        expect(res2.rows.map((r: any) => r.id)).toEqual([projectBId]);

        await client.query('COMMIT;');

        // --- Transaction 3: No tenant context on the SAME connection ---
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        // Explicitly check without setting tenant
        const res3 = await client.query('SELECT id FROM "Project";');
        expect(res3.rows.length).toBe(0);

        await client.query('ROLLBACK;');
      } finally {
        client.release();
      }
    });
  });

  describe('5. AuditLog Tamper Resistance (Trigger & Permission Check)', () => {
    it('Direct UPDATE on AuditLog must fail via trigger trg_prevent_audit_log_mutation', async () => {
      const tenantA = getTenantPrisma(orgAId);
      await expect(
        tenantA.auditLog.update({
          where: { id: auditLogAId },
          data: { action: 'HACKED' },
        })
      ).rejects.toThrow();
    });

    it('Direct DELETE on AuditLog must fail via trigger trg_prevent_audit_log_mutation', async () => {
      const tenantA = getTenantPrisma(orgAId);
      await expect(
        tenantA.auditLog.delete({
          where: { id: auditLogAId },
        })
      ).rejects.toThrow();
    });

    it('Even superuser/admin UPDATE on AuditLog is blocked by trigger unless explicitly disabled', async () => {
      await expect(
        prisma.auditLog.update({
          where: { id: auditLogAId },
          data: { action: 'SUPERUSER_TAMPER' },
        })
      ).rejects.toThrow(/AuditLog records are immutable/i);
    });
  });

  describe('6. Schema RLS Status Verification', () => {
    it('Project and Subscription must have relrowsecurity=true and relforcerowsecurity=true', async () => {
      const res = await rawPool.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity 
        FROM pg_class 
        WHERE relnamespace = 'public'::regnamespace 
          AND relname IN ('Project', 'Subscription', 'AuditLog', 'FeatureFlag', 'UsageEvent', 'OrganizationInvitation', 'Notification')
        ORDER BY relname;
      `);

      const map = new Map(res.rows.map((r) => [r.relname, r]));

      // Project, Subscription, Notification: must be enabled & forced
      expect(map.get('Project')?.relrowsecurity).toBe(true);
      expect(map.get('Project')?.relforcerowsecurity).toBe(true);

      expect(map.get('Subscription')?.relrowsecurity).toBe(true);
      expect(map.get('Subscription')?.relforcerowsecurity).toBe(true);

      expect(map.get('Notification')?.relrowsecurity).toBe(true);
      expect(map.get('Notification')?.relforcerowsecurity).toBe(true);

      // AuditLog, FeatureFlag, UsageEvent, OrganizationInvitation: must be enabled
      expect(map.get('AuditLog')?.relrowsecurity).toBe(true);
      expect(map.get('FeatureFlag')?.relrowsecurity).toBe(true);
      expect(map.get('UsageEvent')?.relrowsecurity).toBe(true);
      expect(map.get('OrganizationInvitation')?.relrowsecurity).toBe(true);
    });
  });

  describe('7. Notification & Pre-Membership Invitation Recipient RLS Verification', () => {
    it('app_user with userA context can see only User A notifications and never User B notifications', async () => {
      // Seed notifications for User A and User B using admin prisma
      const nA = await prisma.notification.create({
        data: {
          userId: userAId,
          type: 'TEST_A',
          title: 'Notification for User A',
        },
      });

      const nB = await prisma.notification.create({
        data: {
          userId: userBId,
          type: 'TEST_B',
          title: 'Notification for User B',
        },
      });

      const client = await rawPool.connect();
      try {
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        await client.query(`SELECT set_config('app.current_user_id', '${userAId}', TRUE);`);

        const resA = await client.query('SELECT id, title FROM "Notification";');
        expect(resA.rows.map((r: any) => r.id)).toContain(nA.id);
        expect(resA.rows.map((r: any) => r.id)).not.toContain(nB.id);

        await client.query('ROLLBACK;');

        // Context User B
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        await client.query(`SELECT set_config('app.current_user_id', '${userBId}', TRUE);`);

        const resB = await client.query('SELECT id, title FROM "Notification";');
        expect(resB.rows.map((r: any) => r.id)).toContain(nB.id);
        expect(resB.rows.map((r: any) => r.id)).not.toContain(nA.id);

        await client.query('ROLLBACK;');
      } finally {
        client.release();
        await prisma.notification.deleteMany({ where: { id: { in: [nA.id, nB.id] } } });
      }
    });

    it('app_user with recipient email context can see invitations sent to that email across organizations', async () => {
      const crypto = require('crypto');
      const emailRecipient = `invitee-recipient-${Date.now()}@example.com`;
      const tokenA = crypto.randomBytes(32).toString('hex');
      const tokenB = crypto.randomBytes(32).toString('hex');

      const invOrgA = await prisma.organizationInvitation.create({
        data: {
          organizationId: orgAId,
          email: emailRecipient,
          inviterId: userAId,
          tokenHash: crypto.createHash('sha256').update(tokenA).digest('hex'),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      const invOrgB = await prisma.organizationInvitation.create({
        data: {
          organizationId: orgBId,
          email: emailRecipient,
          inviterId: userBId,
          tokenHash: crypto.createHash('sha256').update(tokenB).digest('hex'),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      const otherInv = await prisma.organizationInvitation.create({
        data: {
          organizationId: orgAId,
          email: 'someone-else@example.com',
          inviterId: userAId,
          tokenHash: crypto.createHash('sha256').update('other').digest('hex'),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      const client = await rawPool.connect();
      try {
        await client.query('BEGIN;');
        await client.query('SET LOCAL ROLE app_user;');
        // No tenant set, recipient email set
        await client.query(`SELECT set_config('app.current_user_email', '${emailRecipient}', TRUE);`);
        await client.query("SELECT set_config('app.current_tenant_id', '', TRUE);");

        const res = await client.query('SELECT id, email FROM "OrganizationInvitation";');
        const ids = res.rows.map((r: any) => r.id);
        expect(ids).toContain(invOrgA.id);
        expect(ids).toContain(invOrgB.id);
        expect(ids).not.toContain(otherInv.id);

        await client.query('ROLLBACK;');
      } finally {
        client.release();
        await prisma.organizationInvitation.deleteMany({
          where: { id: { in: [invOrgA.id, invOrgB.id, otherInv.id] } },
        });
      }
    });
  });
});

