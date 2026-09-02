import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';

describe('Authentication API', () => {
  let app: FastifyInstance;
  const testEmail = `test-auth-${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should successfully register a new user', async () => {
      const response = await request(app.server)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
    });

    it('should reject duplicate registration with 409 Conflict', async () => {
      const response = await request(app.server)
        .post('/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Email is already registered');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testEmail);
      // Session behavior
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('session=');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('should reject login with wrong password (401)', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({ email: testEmail, password: 'WrongPassword123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject login with unknown user (401)', async () => {
      const response = await request(app.server)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: testPassword });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
    });
  });

  describe('GET /auth/me', () => {
    it('should retrieve session for authenticated user', async () => {
      // First login to get a cookie
      const loginResponse = await request(app.server)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword });
        
      const cookies = loginResponse.headers['set-cookie'];

      // Then request /auth/me
      const response = await request(app.server)
        .get('/auth/me')
        .set('Cookie', cookies);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe(testEmail);
    });

    it('should reject unauthenticated access', async () => {
      const response = await request(app.server).get('/auth/me');
      
      expect(response.status).toBe(401);
    });
  });
});
