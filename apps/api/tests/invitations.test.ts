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
  let memberCookies: string[];
  
  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const owner = await createTestUser(app, 'inv-owner');
    ownerCookies = owner.cookies;
    
    const org = await createTestOrg(app, ownerCookies, 'Inv Org');
    orgId = org.organization.id;

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
});
