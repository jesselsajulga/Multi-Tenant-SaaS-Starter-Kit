import request from 'supertest';
import { FastifyInstance } from 'fastify';

export async function createTestUser(app: FastifyInstance, prefix: string = 'test') {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  const password = 'StrongPassword123!';

  const response = await request(app.server)
    .post('/auth/register')
    .send({ email, password });

  if (response.status !== 201) {
    throw new Error(`Failed to create test user: ${response.text}`);
  }

  const loginResponse = await request(app.server)
    .post('/auth/login')
    .send({ email, password });

  if (loginResponse.status !== 200) {
    throw new Error(`Failed to login test user: ${loginResponse.text}`);
  }

  const cookies = loginResponse.headers['set-cookie'];
  return { email, password, cookies, userId: loginResponse.body.user.id };
}

export async function createTestOrg(app: FastifyInstance, cookies: string[], name: string = 'Test Org') {
  const response = await request(app.server)
    .post('/organizations')
    .set('Cookie', cookies)
    .send({ name: `${name}-${Date.now()}` });

  if (response.status !== 201) {
    throw new Error(`Failed to create test org: ${response.text}`);
  }

  return response.body;
}
