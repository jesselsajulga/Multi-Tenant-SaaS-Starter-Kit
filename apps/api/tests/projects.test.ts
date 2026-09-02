import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { createTestUser, createTestOrg } from './test-utils';

describe('Projects API', () => {
  let app: FastifyInstance;
  let ownerCookies: string[];
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    const owner = await createTestUser(app, 'proj-owner');
    ownerCookies = owner.cookies;
    
    const org = await createTestOrg(app, ownerCookies, 'Project Org');
    orgId = org.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a new project', async () => {
    const response = await request(app.server)
      .post('/projects')
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId)
      .send({ name: 'Alpha Project' });
      
    expect(response.status).toBe(201);
    expect(response.body.project.name).toBe('Alpha Project');
    projectId = response.body.project.id;
  });

  it('should list projects for the organization', async () => {
    const response = await request(app.server)
      .get(`/projects`)
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId);
      
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.projects)).toBe(true);
    expect(response.body.projects.length).toBeGreaterThanOrEqual(1);
    expect(response.body.projects[0].id).toBe(projectId);
  });

  it('should get a single project', async () => {
    const response = await request(app.server)
      .get(`/projects/${projectId}`)
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId);
      
    expect(response.status).toBe(200);
    expect(response.body.project.id).toBe(projectId);
  });

  it('should update a project', async () => {
    const response = await request(app.server)
      .put(`/projects/${projectId}`)
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId)
      .send({ name: 'Alpha Project Renamed' });
      
    expect(response.status).toBe(200);
    expect(response.body.project.name).toBe('Alpha Project Renamed');
  });

  it('should delete a project', async () => {
    const response = await request(app.server)
      .delete(`/projects/${projectId}`)
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId);
      
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Project deleted");

    // Verify deletion
    const getRes = await request(app.server)
      .get(`/projects/${projectId}`)
      .set('Cookie', ownerCookies)
      .set('x-organization-id', orgId);
      
    expect(getRes.status).toBe(404);
  });
});
