import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { createTestUser, createTestOrg } from './test-utils';
import { prisma } from '../src/db';

describe('Invitations API', () => {
  let app: FastifyInstance;
  let ownerCookies: string[];
  let orgId: string;
  let orgName: string;
  let memberCookies: string[];
  
  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const owner = await createTestUser(app, 'inv-owner');
    ownerCookies = owner.cookies;
    
    const org = await createTestOrg(app, ownerCookies, 'Inv Org');
    orgId = org.organization.id;
    orgName = org.organization.name;

    const member = await createTestUser(app, 'inv-member');
    memberCookies = member.cookies;

    // Directly add member
    await prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: member.userId,
        role: 'MEMBER'
      }
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow OWNER to create an invitation', async () => {
    const response = await request(app.server)
      .post(`/organizations/${orgId}/invitations`)
      .set('Cookie', ownerCookies)
      .send({ email: 'new-invitee@example.com' });
      
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Invitation sent successfully');
    expect(response.body.invitationId).toBeDefined();
  });

  it('should reject MEMBER from creating an invitation (403)', async () => {
    const response = await request(app.server)
      .post(`/organizations/${orgId}/invitations`)
      .set('Cookie', memberCookies)
      .send({ email: 'hacker-invitee@example.com' });
      
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Forbidden');
  });

  it('should reject unauthenticated request with 401', async () => {
    const response = await request(app.server)
      .post(`/organizations/${orgId}/invitations`)
      .send({ email: 'unauth-invitee@example.com' });
      
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  describe('GET /invitations/verify', () => {
    it('should return 400 when token is missing', async () => {
      const res = await request(app.server).get('/invitations/verify');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid or missing invitation token');
    });

    it('should return 400 when token is empty', async () => {
      const res = await request(app.server).get('/invitations/verify?token=');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid or missing invitation token');
    });

    it('should return 404 with status INVALID for non-existent token', async () => {
      const res = await request(app.server).get('/invitations/verify?token=nonexistenttoken12345');
      expect(res.status).toBe(404);
      expect(res.body.status).toBe('INVALID');
      expect(res.body.tokenHash).toBeUndefined();
      expect(res.body.inviterId).toBeUndefined();
    });

    it('should return 200 with status PENDING and organizationName for valid pending invitation', async () => {
      const crypto = await import('crypto');
      const rawToken = 'test-pending-token-' + Date.now();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.organizationInvitation.create({
        data: {
          organizationId: orgId,
          email: 'pending-test@example.com',
          inviterId: (await prisma.user.findFirstOrThrow()).id,
          tokenHash,
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.server).get(`/invitations/verify?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.organizationName).toBe(orgName);
      expect(res.body.tokenHash).toBeUndefined();
      expect(res.body.email).toBeUndefined();
      expect(res.body.inviterId).toBeUndefined();
    });

    it('should return 200 with status EXPIRED when invitation is past its expiration date', async () => {
      const crypto = await import('crypto');
      const rawToken = 'test-expired-token-' + Date.now();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.organizationInvitation.create({
        data: {
          organizationId: orgId,
          email: 'expired-test@example.com',
          inviterId: (await prisma.user.findFirstOrThrow()).id,
          tokenHash,
          role: 'MEMBER',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 10000),
        },
      });

      const res = await request(app.server).get(`/invitations/verify?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXPIRED');
      expect(res.body.organizationName).toBe(orgName);
    });

    it('should return 200 with status REVOKED when internal status is CANCELED', async () => {
      const crypto = await import('crypto');
      const rawToken = 'test-canceled-token-' + Date.now();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.organizationInvitation.create({
        data: {
          organizationId: orgId,
          email: 'canceled-test@example.com',
          inviterId: (await prisma.user.findFirstOrThrow()).id,
          tokenHash,
          role: 'MEMBER',
          status: 'CANCELED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.server).get(`/invitations/verify?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REVOKED');
      expect(res.body.organizationName).toBe(orgName);
    });

    it('should return 200 with status ACCEPTED when invitation was already accepted', async () => {
      const crypto = await import('crypto');
      const rawToken = 'test-accepted-token-' + Date.now();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.organizationInvitation.create({
        data: {
          organizationId: orgId,
          email: 'accepted-test@example.com',
          inviterId: (await prisma.user.findFirstOrThrow()).id,
          tokenHash,
          role: 'MEMBER',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.server).get(`/invitations/verify?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.organizationName).toBe(orgName);
    });

    it('should return 200 with status REJECTED when invitation was declined', async () => {
      const crypto = await import('crypto');
      const rawToken = 'test-declined-token-' + Date.now();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.organizationInvitation.create({
        data: {
          organizationId: orgId,
          email: 'declined-test@example.com',
          inviterId: (await prisma.user.findFirstOrThrow()).id,
          tokenHash,
          role: 'MEMBER',
          status: 'REJECTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.server).get(`/invitations/verify?token=${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.organizationName).toBe(orgName);
    });
  });
});
