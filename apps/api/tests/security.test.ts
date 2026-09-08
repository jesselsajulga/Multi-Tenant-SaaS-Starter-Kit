import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db';
import { createTestUser, createTestOrg } from './test-utils';

describe('Security Integration Tests (HTTP & Application Boundary)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Authentication & Session Security Boundary', () => {
    it('should reject login with an invalid password (401 Unauthorized)', async () => {
      const email = `auth-fail-${Date.now()}@example.com`;
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword456!';

      // Register user
      await request(app.server)
        .post('/auth/register')
        .send({ email, password: correctPassword });

      // Attempt login with wrong password
      const res = await request(app.server)
        .post('/auth/login')
        .send({ email, password: wrongPassword });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should reject unauthenticated access to protected routes (401 Unauthorized)', async () => {
      // /auth/me
      const meRes = await request(app.server).get('/auth/me');
      expect(meRes.status).toBe(401);

      // /organizations
      const orgsRes = await request(app.server).get('/organizations');
      expect(orgsRes.status).toBe(401);

      // /projects
      const projRes = await request(app.server).get('/projects');
      expect(projRes.status).toBe(401);
    });

    it('should store ONLY hashed session tokens in database, never raw tokens', async () => {
      const user = await createTestUser(app, 'token-hash-check');
      const cookieHeader = user.cookies.find((c: string) => c.startsWith('session='));
      expect(cookieHeader).toBeDefined();

      const rawTokenMatch = cookieHeader!.match(/session=([^;]+)/);
      expect(rawTokenMatch).not.toBeNull();
      const rawToken = decodeURIComponent(rawTokenMatch![1]);

      // Query database directly: verify no session row contains the raw token
      const rawMatches = await prisma.session.findMany({
        where: { tokenHash: rawToken },
      });
      expect(rawMatches).toHaveLength(0);

      // Verify a session row exists for this user with a valid 64-char sha256 hash
      const userSessions = await prisma.session.findMany({
        where: { userId: user.userId },
      });
      expect(userSessions.length).toBeGreaterThanOrEqual(1);
      expect(userSessions[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should reject access immediately once session is logged out / revoked', async () => {
      const user = await createTestUser(app, 'session-revocation');

      // Valid session succeeds
      const beforeLogout = await request(app.server)
        .get('/auth/me')
        .set('Cookie', user.cookies);
      expect(beforeLogout.status).toBe(200);

      // Logout
      const logoutRes = await request(app.server)
        .post('/auth/logout')
        .set('Cookie', user.cookies);
      expect(logoutRes.status).toBe(200);

      // Subsequent access with same cookies is rejected with 401
      const afterLogout = await request(app.server)
        .get('/auth/me')
        .set('Cookie', user.cookies);
      expect(afterLogout.status).toBe(401);
    });

    it('should reject access when session has expired', async () => {
      const user = await createTestUser(app, 'session-expiry');

      // Manually set session expiresAt to the past in the database
      await prisma.session.updateMany({
        where: { userId: user.userId },
        data: { expiresAt: new Date(Date.now() - 10000) },
      });

      const res = await request(app.server)
        .get('/auth/me')
        .set('Cookie', user.cookies);
      expect(res.status).toBe(401);
    });
  });

  describe('2. Role-Based Access Control (RBAC) Boundary', () => {
    let ownerCookies: string[];
    let memberCookies: string[];
    let orgId: string;

    beforeAll(async () => {
      // Create Owner and Organization
      const owner = await createTestUser(app, 'rbac-owner');
      ownerCookies = owner.cookies;
      const org = await createTestOrg(app, ownerCookies, 'RBAC Protected Org');
      orgId = org.organization.id;

      // Create Member user
      const member = await createTestUser(app, 'rbac-member');
      memberCookies = member.cookies;

      // Add Member to Org with MEMBER role
      await prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId: member.userId,
          role: 'MEMBER',
        },
      });
    });

    it('MEMBER cannot update organization settings (PATCH /organizations/:id -> 403)', async () => {
      const res = await request(app.server)
        .patch(`/organizations/${orgId}`)
        .set('Cookie', memberCookies)
        .send({ name: 'Hacked by Member' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Requires OWNER role/i);

      // Verify org name was not changed
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      expect(org?.name).not.toBe('Hacked by Member');
    });

    it('OWNER can update organization settings (PATCH /organizations/:id -> 200)', async () => {
      const res = await request(app.server)
        .patch(`/organizations/${orgId}`)
        .set('Cookie', ownerCookies)
        .send({ name: 'Renamed by Owner' });

      expect(res.status).toBe(200);
      expect(res.body.organization.name).toBe('Renamed by Owner');
    });

    it('MEMBER cannot create invitations (POST /organizations/:id/invitations -> 403)', async () => {
      const res = await request(app.server)
        .post(`/organizations/${orgId}/invitations`)
        .set('Cookie', memberCookies)
        .send({ email: 'invitee@example.com', role: 'MEMBER' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Requires OWNER role/i);
    });

    it('OWNER can create invitations (POST /organizations/:id/invitations -> 201)', async () => {
      const res = await request(app.server)
        .post(`/organizations/${orgId}/invitations`)
        .set('Cookie', ownerCookies)
        .send({ email: `invitee-${Date.now()}@example.com`, role: 'MEMBER' });

      expect(res.status).toBe(201);
      expect(res.body.invitationId).toBeDefined();
      expect(res.body.message).toMatch(/invitation sent/i);
    });

    it('MEMBER cannot initiate billing checkout or portal access -> 403', async () => {
      // Checkout
      const checkoutRes = await request(app.server)
        .post(`/organizations/${orgId}/billing/checkout`)
        .set('Cookie', memberCookies)
        .send({ plan: 'pro' });

      expect(checkoutRes.status).toBe(403);
      expect(checkoutRes.body.error).toMatch(/Requires OWNER role/i);

      // Portal
      const portalRes = await request(app.server)
        .post(`/organizations/${orgId}/billing/portal`)
        .set('Cookie', memberCookies);

      expect(portalRes.status).toBe(403);
      expect(portalRes.body.error).toMatch(/Requires OWNER role/i);
    });

    it('MEMBER cannot access audit logs (GET /organizations/:id/audit-logs -> 403)', async () => {
      const res = await request(app.server)
        .get(`/organizations/${orgId}/audit-logs`)
        .set('Cookie', memberCookies);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Requires OWNER role/i);
    });

    it('OWNER can access audit logs (GET /organizations/:id/audit-logs -> 200)', async () => {
      const res = await request(app.server)
        .get(`/organizations/${orgId}/audit-logs`)
        .set('Cookie', ownerCookies);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.auditLogs)).toBe(true);
    });
  });

  describe('3. Cross-Tenant API Tampering & Parameter Spoofing Boundary', () => {
    let userACookies: string[];
    let orgAId: string;

    let userBCookies: string[];
    let orgBId: string;

    beforeAll(async () => {
      const userA = await createTestUser(app, 'cross-user-a');
      userACookies = userA.cookies;
      const orgA = await createTestOrg(app, userACookies, 'Org A');
      orgAId = orgA.organization.id;

      const userB = await createTestUser(app, 'cross-user-b');
      userBCookies = userB.cookies;
      const orgB = await createTestOrg(app, userBCookies, 'Org B');
      orgBId = orgB.organization.id;
    });

    it('User A cannot read Org B via route parameter (GET /organizations/:orgBId -> 403)', async () => {
      const res = await request(app.server)
        .get(`/organizations/${orgBId}`)
        .set('Cookie', userACookies);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('User A cannot update Org B via route parameter (PATCH /organizations/:orgBId -> 403)', async () => {
      const res = await request(app.server)
        .patch(`/organizations/${orgBId}`)
        .set('Cookie', userACookies)
        .send({ name: 'Tampered by User A' });

      expect(res.status).toBe(403);
    });

    it('User A cannot create a project in Org B by spoofing x-organization-id header (403 Forbidden)', async () => {
      const res = await request(app.server)
        .post('/projects')
        .set('Cookie', userACookies)
        .set('x-organization-id', orgBId) // Spoofed to Org B
        .send({ name: 'Cross-Tenant Project Attack' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');

      // Verify no project was created in Org B
      const orgBProjects = await prisma.project.findMany({
        where: { organizationId: orgBId },
      });
      expect(orgBProjects.map((p) => p.name)).not.toContain('Cross-Tenant Project Attack');
    });

    it('User A cannot list projects from Org B by spoofing x-organization-id header (403 Forbidden)', async () => {
      const res = await request(app.server)
        .get('/projects')
        .set('Cookie', userACookies)
        .set('x-organization-id', orgBId);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('4. Audit Log Immutability & API Surface Defense', () => {
    let ownerCookies: string[];
    let orgId: string;

    beforeAll(async () => {
      const owner = await createTestUser(app, 'audit-api-test');
      ownerCookies = owner.cookies;
      const org = await createTestOrg(app, ownerCookies, 'Audit Immutability Org');
      orgId = org.organization.id;

      // Trigger an event to generate an audit log
      await request(app.server)
        .post('/projects')
        .set('Cookie', ownerCookies)
        .set('x-organization-id', orgId)
        .send({ name: 'Audit Source Project' });
    });

    it('API exposes NO route for modifying audit logs (PUT/PATCH/DELETE -> 404 Not Found)', async () => {
      // Get the existing audit log id
      const listRes = await request(app.server)
        .get(`/organizations/${orgId}/audit-logs`)
        .set('Cookie', ownerCookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.auditLogs.length).toBeGreaterThanOrEqual(1);
      const logId = listRes.body.auditLogs[0].id;

      // Attempt PATCH
      const patchRes = await request(app.server)
        .patch(`/organizations/${orgId}/audit-logs/${logId}`)
        .set('Cookie', ownerCookies)
        .send({ action: 'MUTATED' });
      expect([404, 405]).toContain(patchRes.status);

      // Attempt PUT
      const putRes = await request(app.server)
        .put(`/organizations/${orgId}/audit-logs/${logId}`)
        .set('Cookie', ownerCookies)
        .send({ action: 'MUTATED' });
      expect([404, 405]).toContain(putRes.status);

      // Attempt DELETE
      const deleteRes = await request(app.server)
        .delete(`/organizations/${orgId}/audit-logs/${logId}`)
        .set('Cookie', ownerCookies);
      expect([404, 405]).toContain(deleteRes.status);

      // Verify the log remains intact in database
      const logInDb = await prisma.auditLog.findUnique({ where: { id: logId } });
      expect(logInDb).not.toBeNull();
      expect(logInDb?.action).toBe('PROJECT_CREATED');
    });
  });

  describe('5. Production Error Sanitization Boundary', () => {
    it('sanitizes unexpected 5xx errors in production without exposing internal driver/stack details', async () => {
      // Build a test app instance with NODE_ENV="production"
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodApp = buildApp();
      // Inject a test route that throws an internal database-like error
      prodApp.get('/test-error-leakage', async () => {
        const err = new Error('PrismaClientKnownRequestError: relation "secret_table" does not exist at /app/dist/db.js:42');
        (err as any).statusCode = 500;
        throw err;
      });

      await prodApp.ready();

      try {
        const res = await request(prodApp.server).get('/test-error-leakage');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Internal Server Error' });
        // Must NOT leak internal stack trace, file paths, or table names
        expect(JSON.stringify(res.body)).not.toMatch(/secret_table/);
        expect(JSON.stringify(res.body)).not.toMatch(/PrismaClientKnownRequestError/);
        expect(JSON.stringify(res.body)).not.toMatch(/\/app\/dist/);
      } finally {
        await prodApp.close();
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});

