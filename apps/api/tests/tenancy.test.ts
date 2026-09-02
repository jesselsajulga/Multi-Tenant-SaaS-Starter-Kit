import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { createTestUser, createTestOrg } from './test-utils';

describe('Tenant Isolation', () => {
  let app: FastifyInstance;
  let userACookies: string[];
  let orgA: string;
  let userBCookies: string[];
  let orgB: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // User A and Org A
    const userA = await createTestUser(app, 'user-a');
    userACookies = userA.cookies;
    const createdOrgA = await createTestOrg(app, userACookies, 'Org A');
    orgA = createdOrgA.organization.id;

    // User B and Org B
    const userB = await createTestUser(app, 'user-b');
    userBCookies = userB.cookies;
    const createdOrgB = await createTestOrg(app, userBCookies, 'Org B');
    orgB = createdOrgB.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow User A to access Org A', async () => {
    const response = await request(app.server)
      .get(`/organizations/${orgA}`)
      .set('Cookie', userACookies);
      
    expect(response.status).toBe(200);
    expect(response.body.organization.id).toBe(orgA);
  });

  it('should reject User A accessing Org B (403 or 404)', async () => {
    const response = await request(app.server)
      .get(`/organizations/${orgB}`)
      .set('Cookie', userACookies);
      
    expect([403, 404]).toContain(response.status);
  });

  it('should reject x-organization-id tampering', async () => {
    // User A trying to get Org B's data by tampering the path or header
    // Some routes might use headers, but path-based is the standard here
    // Let's test a resource creation in Org B using User A's session
    const response = await request(app.server)
      .post(`/projects`)
      .set('Cookie', userACookies)
      .set('x-organization-id', orgB) // tampered
      .send({ name: 'Tampered Project', organizationId: orgB });
      
    expect([400, 403, 404]).toContain(response.status);
    if (response.status === 201) {
      throw new Error("Tampering succeeded! RLS/Authorization failed.");
    }
  });

  it('RLS Defense-in-Depth: should isolate data', async () => {
    // Create a project in Org A
    await request(app.server)
      .post(`/projects`)
      .set('Cookie', userACookies)
      .set('x-organization-id', orgA)
      .send({ name: 'Project A' });

    // User B should not see Project A when fetching their projects
    const response = await request(app.server)
      .get(`/projects`)
      .set('Cookie', userBCookies)
      .set('x-organization-id', orgB);
      
    expect(response.status).toBe(200);
    const projects = response.body.projects;
    expect(projects).toHaveLength(0); // Org B has no projects yet
  });
});
