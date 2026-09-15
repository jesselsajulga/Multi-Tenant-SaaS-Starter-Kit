import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { createTestUser, createTestOrg } from './test-utils';
import { prisma } from '../src/db';

describe('Authorization & RBAC', () => {
  let app: FastifyInstance;
  let ownerCookies: string[];
  let memberCookies: string[];
  let orgId: string;
  let memberId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const owner = await createTestUser(app, 'owner');
    ownerCookies = owner.cookies;
    
    const org = await createTestOrg(app, ownerCookies, 'RBAC Test Org');
    orgId = org.organization.id;

    const member = await createTestUser(app, 'member');
    memberCookies = member.cookies;
    memberId = member.userId;

    // Directly add member to org via internal Prisma to avoid invitation flow complexities in auth tests
    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: memberId,
        role: 'MEMBER'
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('OWNER access', () => {
    it('should allow OWNER to access audit logs', async () => {
      const response = await request(app.server)
        .get(`/organizations/${orgId}/audit-logs`)
        .set('Cookie', ownerCookies);
        
      expect(response.status).toBe(200);
    });
  });

  describe('MEMBER access', () => {
    it('should reject MEMBER access to audit logs (403)', async () => {
      const response = await request(app.server)
        .get(`/organizations/${orgId}/audit-logs`)
        .set('Cookie', memberCookies);
        
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });
  });

  describe('Unauthenticated access', () => {
    it('should reject unauthenticated access to organization resources (401)', async () => {
      const response = await request(app.server)
        .get(`/organizations/${orgId}/audit-logs`);
        
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Member Removal & Transactional Email Notification', () => {
    it('should allow OWNER to remove a member and dispatch transactional email informing access revocation', async () => {
      const logSpy = vi.spyOn(app.log, 'info');

      const response = await request(app.server)
        .delete(`/organizations/${orgId}/members/${memberId}`)
        .set('Cookie', ownerCookies);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Member removed successfully');

      // Verify simulated transactional email was dispatched
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Simulated Email: Workspace Access Revoked',
          to: expect.stringContaining('@example.com'),
          workspaceName: expect.stringContaining('RBAC Test Org'),
          message: expect.stringMatching(/Your access to RBAC Test Org.* has been revoked\./)
        })
      );

      // Verify membership was removed in database
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: memberId
          }
        }
      });
      expect(membership).toBeNull();
    });
  });
});
