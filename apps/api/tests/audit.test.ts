import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { createTestUser, createTestOrg } from './test-utils';
import { prisma } from '../src/db';

describe('Audit Logs API', () => {
  let app: FastifyInstance;
  let ownerCookies: string[];
  let orgId: string;
  let memberCookies: string[];
  let userBOrgId: string;
  let userBCookies: string[];

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Org A (Owner)
    const owner = await createTestUser(app, 'audit-owner');
    ownerCookies = owner.cookies;
    const org = await createTestOrg(app, ownerCookies, 'Audit Org A');
    orgId = org.organization.id;

    // Org A (Member)
    const member = await createTestUser(app, 'audit-member');
    memberCookies = member.cookies;
    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: member.userId,
        role: 'MEMBER'
      }
    });

    // Org B (User B)
    const userB = await createTestUser(app, 'audit-userb');
    userBCookies = userB.cookies;
    const orgB = await createTestOrg(app, userBCookies, 'Audit Org B');
    userBOrgId = orgB.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should record an audit event on project creation and allow OWNER to read it', async () => {
    // 1. Trigger an audited action
    await request(app.server)
      .post('/projects')
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId)
      .send({ name: 'Audited Project' });

    // 2. Fetch audit logs as OWNER
    const response = await request(app.server)
      .get(`/organizations/${orgId}/audit-logs`)
      .set('Cookie', ownerCookies);
      
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.auditLogs)).toBe(true);
    
    // We expect to see PROJECT_CREATED
    const hasProjectCreated = response.body.auditLogs.some((log: any) => log.action === 'PROJECT_CREATED');
    expect(hasProjectCreated).toBe(true);
  });

  it('should reject MEMBER access to audit logs (403)', async () => {
    const response = await request(app.server)
      .get(`/organizations/${orgId}/audit-logs`)
      .set('Cookie', memberCookies);
      
    expect(response.status).toBe(403);
  });

  it('should reject cross-organization access to audit logs (403/400)', async () => {
    const response = await request(app.server)
      .get(`/organizations/${orgId}/audit-logs`)
      .set('Cookie', userBCookies); // User B from Org B trying to read Org A
      
    expect([400, 403]).toContain(response.status);
  });
});
