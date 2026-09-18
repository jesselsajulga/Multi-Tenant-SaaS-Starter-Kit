import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { createTestUser, createTestOrg } from './test-utils';

describe('Unified Notification Feed API & Navigation Contract Suite', () => {
  let app: FastifyInstance;
  let user1: { userId: string; email: string; cookies: string[] };
  let user2: { userId: string; email: string; cookies: string[] };
  let orgId: string;
  let inviteId: string;
  let notifIds: string[] = [];

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    user1 = await createTestUser(app, 'history-owner');
    user2 = await createTestUser(app, 'history-user');

    const orgRes = await createTestOrg(app, user1.cookies, `Org-${Date.now()}`);
    orgId = orgRes.organization.id;

    // 1. User 1 invites User 2 (generates MEMBER_INVITATION for user2)
    const invRes = await request(app.server)
      .post(`/organizations/${orgId}/invitations`)
      .set('Cookie', user1.cookies)
      .send({ email: user2.email });
    inviteId = invRes.body.invitationId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. GET /notifications returns feed with invitation metadata for actionable invitations', async () => {
    const res = await request(app.server)
      .get('/notifications')
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toBeDefined();
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);

    const inviteNotif = res.body.notifications.find((n: any) => n.invitationId === inviteId);
    expect(inviteNotif).toBeDefined();
    expect(inviteNotif.type).toBe('MEMBER_INVITATION');
    expect(inviteNotif.invitation).toBeDefined();
    expect(inviteNotif.invitation.id).toBe(inviteId);
    expect(inviteNotif.invitation.status).toBe('PENDING');
    expect(inviteNotif.invitation.organization).toBeDefined();
    expect(inviteNotif.readAt).toBeNull();
  });

  it('2. Cursor pagination behaves correctly without skipping or duplicating records', async () => {
    const res = await request(app.server)
      .get('/notifications?limit=1')
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBe(1);

    if (res.body.nextCursor) {
      const page2 = await request(app.server)
        .get(`/notifications?limit=1&cursor=${res.body.nextCursor}`)
        .set('Cookie', user2.cookies);

      expect(page2.status).toBe(200);
      expect(page2.body.notifications[0].id).not.toBe(res.body.notifications[0].id);
    }
  });

  it('3. Preserves read-state semantics: fetching does not mark read, explicit read marks record', async () => {
    // Check initial unread
    const initial = await request(app.server)
      .get('/notifications')
      .set('Cookie', user2.cookies);

    const targetNotif = initial.body.notifications[0];
    expect(targetNotif.readAt).toBeNull();

    // Explicit read
    const patchRes = await request(app.server)
      .patch(`/notifications/${targetNotif.id}/read`)
      .set('Cookie', user2.cookies);
    expect(patchRes.status).toBe(200);

    // Verify marked read
    const after = await request(app.server)
      .get('/notifications')
      .set('Cookie', user2.cookies);
    const updated = after.body.notifications.find((n: any) => n.id === targetNotif.id);
    expect(updated.readAt).not.toBeNull();
  });
});
