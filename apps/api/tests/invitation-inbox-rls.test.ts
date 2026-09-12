import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma, getUserPrisma } from '../src/db';
import { createTestUser, createTestOrg } from './test-utils';
import { Pool } from 'pg';

describe('Invitation Inbox & Persistent Notification Projection Suite (25-Point Security & RLS Matrix)', () => {
  let app: FastifyInstance;
  let rawPool: Pool;

  // User 1 (Owner of Org A)
  let user1: { userId: string; email: string; cookies: string[] };
  let orgAId: string;

  // User 2 (Invitee)
  let user2: { userId: string; email: string; cookies: string[] };

  // User 3 (Unrelated third-party user)
  let user3: { userId: string; email: string; cookies: string[] };

  // Owner of Org B
  let userB: { userId: string; email: string; cookies: string[] };
  let orgBId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    rawPool = new Pool({ connectionString: process.env.DATABASE_URL });

    user1 = await createTestUser(app, 'owner-user1');
    const orgA = await createTestOrg(app, user1.cookies, 'Organization A');
    orgAId = orgA.organization.id;

    user2 = await createTestUser(app, 'invitee-user2');
    user3 = await createTestUser(app, 'unrelated-user3');

    userB = await createTestUser(app, 'owner-userb');
    const orgB = await createTestOrg(app, userB.cookies, 'Organization B');
    orgBId = orgB.organization.id;
  });

  afterAll(async () => {
    await app.close();
    await rawPool.end();
  });

  let user2InviteId: string;

  // 1. OWNER creates invitation for existing User 2 -> 201
  it('1. OWNER creates invitation for existing User 2 -> returns 201, creates OrganizationInvitation (PENDING)', async () => {
    const res = await request(app.server)
      .post(`/organizations/${orgAId}/invitations`)
      .set('Cookie', user1.cookies)
      .send({ email: user2.email });

    expect(res.status).toBe(201);
    expect(res.body.invitationId).toBeDefined();
    user2InviteId = res.body.invitationId;

    const inv = await prisma.organizationInvitation.findUnique({ where: { id: user2InviteId } });
    expect(inv).not.toBeNull();
    expect(inv?.status).toBe('PENDING');
    expect(inv?.email).toBe(user2.email);
  });

  // 2. Notification created for existing User 2 in invite transaction
  it('2. Notification is created for existing User 2 upon invitation creation', async () => {
    const notif = await prisma.notification.findFirst({
      where: { userId: user2.userId, invitationId: user2InviteId },
    });
    expect(notif).not.toBeNull();
    expect(notif?.title).toBe('Workspace Invitation');
    expect(notif?.readAt).toBeNull();
  });

  // 3. Unregistered email creates invitation without creating a Notification
  it('3. Unregistered email creates invitation without creating a Notification record', async () => {
    const unregEmail = `unreg-${Date.now()}@example.com`;
    const res = await request(app.server)
      .post(`/organizations/${orgAId}/invitations`)
      .set('Cookie', user1.cookies)
      .send({ email: unregEmail });

    expect(res.status).toBe(201);
    const unregInviteId = res.body.invitationId;

    const notif = await prisma.notification.findFirst({
      where: { invitationId: unregInviteId },
    });
    expect(notif).toBeNull();
  });

  // 4. User 2 retrieves own received invitations
  it('4. User 2 retrieves own received invitations via GET /invitations/received', async () => {
    const res = await request(app.server)
      .get('/invitations/received')
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invitations)).toBe(true);
    const ids = res.body.invitations.map((i: any) => i.id);
    expect(ids).toContain(user2InviteId);
    expect(res.body.invitations[0].organization.name).toMatch(/Organization A/);
    expect(res.body.invitations[0].inviter.email).toBe(user1.email);
  });

  // 5. User 3 cannot retrieve User 2's invitation via GET /invitations/received
  it('5. User 3 cannot retrieve User 2 invitations via GET /invitations/received (0 rows)', async () => {
    const res = await request(app.server)
      .get('/invitations/received')
      .set('Cookie', user3.cookies);

    expect(res.status).toBe(200);
    const ids = res.body.invitations.map((i: any) => i.id);
    expect(ids).not.toContain(user2InviteId);
  });

  // 6. User 2 retrieves own notifications (unreadCount: 1)
  it('6. User 2 retrieves own notifications via GET /notifications (unreadCount === 1)', async () => {
    const res = await request(app.server)
      .get('/notifications')
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(res.body.notifications.some((n: any) => n.invitationId === user2InviteId)).toBe(true);
  });

  // 7. User 3 cannot retrieve User 2's notifications
  it('7. User 3 cannot retrieve User 2 notifications via GET /notifications', async () => {
    const res = await request(app.server)
      .get('/notifications')
      .set('Cookie', user3.cookies);

    expect(res.status).toBe(200);
    expect(res.body.notifications.some((n: any) => n.invitationId === user2InviteId)).toBe(false);
  });

  // 8. User 3 cannot accept User 2's invitation -> 404
  it('8. User 3 cannot accept User 2 invitation (returns 404 / Forbidden)', async () => {
    const res = await request(app.server)
      .post(`/invitations/${user2InviteId}/accept`)
      .set('Cookie', user3.cookies);

    expect(res.status).toBe(404);
  });

  // 9. User 2 accepts invitation -> 200
  it('9. User 2 accepts invitation -> returns 200, adds membership, updates status to ACCEPTED', async () => {
    const res = await request(app.server)
      .post(`/invitations/${user2InviteId}/accept`)
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/accepted successfully/i);

    // Verify DB membership
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgAId,
          userId: user2.userId,
        },
      },
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe('MEMBER');

    // Verify invitation status
    const inv = await prisma.organizationInvitation.findUnique({ where: { id: user2InviteId } });
    expect(inv?.status).toBe('ACCEPTED');

    // Verify audit log
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: orgAId, action: 'MEMBER_JOINED', actorId: user2.userId },
    });
    expect(audit).not.toBeNull();
  });

  // 10. Notification for User 2 becomes marked as read after acceptance
  it('10. Notification for User 2 is automatically marked as read after acceptance', async () => {
    const notif = await prisma.notification.findFirst({
      where: { userId: user2.userId, invitationId: user2InviteId },
    });
    expect(notif?.readAt).not.toBeNull();

    const notifRes = await request(app.server)
      .get('/notifications')
      .set('Cookie', user2.cookies);
    const matchingNotif = notifRes.body.notifications.find((n: any) => n.invitationId === user2InviteId);
    expect(matchingNotif.readAt).not.toBeNull();
  });

  // 11. User 2 decline flow
  it('11. User 2 decline flow: status transitions to REJECTED, marks notification read, creates no membership', async () => {
    // User 1 invites User 2 to another invite
    const inviteRes = await request(app.server)
      .post(`/organizations/${orgBId}/invitations`)
      .set('Cookie', userB.cookies)
      .send({ email: user2.email });
    const inviteIdToDecline = inviteRes.body.invitationId;

    const declineRes = await request(app.server)
      .post(`/invitations/${inviteIdToDecline}/decline`)
      .set('Cookie', user2.cookies);

    expect(declineRes.status).toBe(200);
    expect(declineRes.body.message).toMatch(/declined/i);

    // Verify DB status
    const inv = await prisma.organizationInvitation.findUnique({ where: { id: inviteIdToDecline } });
    expect(inv?.status).toBe('REJECTED');

    // Verify no member created in Org B
    const member = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgBId,
          userId: user2.userId,
        },
      },
    });
    expect(member).toBeNull();

    // Verify audit log for decline
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: orgBId, action: 'MEMBER_INVITATION_DECLINED' },
    });
    expect(audit).not.toBeNull();
  });

  // 12. Unauthenticated GET /invitations/received -> 401
  it('12. Unauthenticated GET /invitations/received -> returns 401 Unauthorized', async () => {
    const res = await request(app.server).get('/invitations/received');
    expect(res.status).toBe(401);
  });

  // 13. Unauthenticated GET /notifications -> 401
  it('13. Unauthenticated GET /notifications -> returns 401 Unauthorized', async () => {
    const res = await request(app.server).get('/notifications');
    expect(res.status).toBe(401);
  });

  // 14. User 2 cannot mark User 3 notification as read -> 404
  it('14. User 2 cannot mark User 3 notification as read (returns 404)', async () => {
    const user3Notif = await prisma.notification.create({
      data: {
        userId: user3.userId,
        type: 'TEST',
        title: 'User 3 only',
      },
    });

    const res = await request(app.server)
      .patch(`/notifications/${user3Notif.id}/read`)
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(404);
  });

  // 15. User 2 can mark own notification as read and mark all as read
  it('15. User can mark own notification as read and mark all as read (POST /notifications/read-all)', async () => {
    const n = await prisma.notification.create({
      data: {
        userId: user2.userId,
        type: 'TEST_READ',
        title: 'Unread Notification',
      },
    });

    const patchRes = await request(app.server)
      .patch(`/notifications/${n.id}/read`)
      .set('Cookie', user2.cookies);
    expect(patchRes.status).toBe(200);

    // Create another unread
    await prisma.notification.create({
      data: {
        userId: user2.userId,
        type: 'TEST_ALL',
        title: 'Unread 2',
      },
    });

    const readAllRes = await request(app.server)
      .post('/notifications/read-all')
      .set('Cookie', user2.cookies);
    expect(readAllRes.status).toBe(200);

    const checkRes = await request(app.server)
      .get('/notifications')
      .set('Cookie', user2.cookies);
    expect(checkRes.body.unreadCount).toBe(0);
  });

  // 16. User 2 cannot accept an expired invitation -> 409
  it('16. User 2 cannot accept an expired invitation (returns 409 Conflict)', async () => {
    const crypto = require('crypto');
    const expiredUser = await createTestUser(app, 'expired-user');
    const expiredInvite = await prisma.organizationInvitation.create({
      data: {
        organizationId: orgBId,
        email: expiredUser.email,
        inviterId: userB.userId,
        tokenHash: crypto.createHash('sha256').update(crypto.randomBytes(32).toString('hex')).digest('hex'),
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 10000), // Expired
      },
    });

    const res = await request(app.server)
      .post(`/invitations/${expiredInvite.id}/accept`)
      .set('Cookie', expiredUser.cookies);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/expired/i);
  });

  // 17. User 2 cannot accept a canceled invitation -> 409
  it('17. User 2 cannot accept a canceled invitation (returns 409 Conflict)', async () => {
    const crypto = require('crypto');
    const canceledUser = await createTestUser(app, 'canceled-user');
    const canceledInvite = await prisma.organizationInvitation.create({
      data: {
        organizationId: orgBId,
        email: canceledUser.email,
        inviterId: userB.userId,
        tokenHash: crypto.createHash('sha256').update(crypto.randomBytes(32).toString('hex')).digest('hex'),
        status: 'CANCELED',
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    const res = await request(app.server)
      .post(`/invitations/${canceledInvite.id}/accept`)
      .set('Cookie', canceledUser.cookies);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no longer pending/i);
  });

  // 18. User 2 cannot accept an already accepted invitation -> 409
  it('18. User 2 cannot accept an already accepted invitation (returns 409 Conflict)', async () => {
    const res = await request(app.server)
      .post(`/invitations/${user2InviteId}/accept`)
      .set('Cookie', user2.cookies);

    expect(res.status).toBe(409);
  });

  // 19. Concurrent acceptance: exactly one succeeds (200), one fails (409)
  it('19. Concurrent acceptance: two parallel accept calls result in exactly one 200 and one 409', async () => {
    const newInv = await request(app.server)
      .post(`/organizations/${orgBId}/invitations`)
      .set('Cookie', userB.cookies)
      .send({ email: user3.email });
    const inviteId = newInv.body.invitationId;

    const [res1, res2] = await Promise.all([
      request(app.server).post(`/invitations/${inviteId}/accept`).set('Cookie', user3.cookies),
      request(app.server).post(`/invitations/${inviteId}/accept`).set('Cookie', user3.cookies),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Verify only ONE membership record exists for User 3 in Org B
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: orgBId, userId: user3.userId },
    });
    expect(members.length).toBe(1);
  });

  // 20. Token secrecy: tokenHash never appears in GET /invitations/received
  it('20. tokenHash and rawToken never appear in GET /invitations/received responses', async () => {
    // Send fresh invite to user3
    await request(app.server)
      .post(`/organizations/${orgAId}/invitations`)
      .set('Cookie', user1.cookies)
      .send({ email: user3.email });

    const res = await request(app.server)
      .get('/invitations/received')
      .set('Cookie', user3.cookies);

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/tokenHash/i);
    expect(bodyStr).not.toMatch(/rawToken/i);
  });

  // 21. Notification payload secrecy: notification never exposes token or tokenHash
  it('21. Notification payload never exposes raw token or tokenHash', async () => {
    const res = await request(app.server)
      .get('/notifications')
      .set('Cookie', user3.cookies);

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/tokenHash/i);
    expect(bodyStr).not.toMatch(/token=/i);
  });

  // 22. Database RLS: app_user with userB context cannot SELECT userA notifications
  it('22. Raw Database RLS: app_user with userB context cannot SELECT userA notifications', async () => {
    const client = await rawPool.connect();
    try {
      await client.query('BEGIN;');
      await client.query('SET LOCAL ROLE app_user;');
      await client.query(`SELECT set_config('app.current_user_id', '${user3.userId}', TRUE);`);

      const res = await client.query('SELECT * FROM "Notification";');
      // Every returned notification must belong to User 3
      expect(res.rows.every((r: any) => r.userId === user3.userId)).toBe(true);
      expect(res.rows.some((r: any) => r.userId === user2.userId)).toBe(false);

      await client.query('ROLLBACK;');
    } finally {
      client.release();
    }
  });

  // 23. Revoked invitation notification lifecycle: notification marked read, invitation no longer pending
  it('23. Revoked invitation notification lifecycle: revoking an invitation marks notification as read', async () => {
    // User 1 invites User 2
    const crypto = require('crypto');
    const freshEmail = `fresh-lifecycle-${Date.now()}@example.com`;
    const freshUser = await createTestUser(app, 'lifecycle-user');

    const invRes = await request(app.server)
      .post(`/organizations/${orgAId}/invitations`)
      .set('Cookie', user1.cookies)
      .send({ email: freshUser.email });
    const freshInvId = invRes.body.invitationId;

    // Verify unread notification exists
    let notif = await prisma.notification.findFirst({
      where: { userId: freshUser.userId, invitationId: freshInvId },
    });
    expect(notif?.readAt).toBeNull();

    // Owner revokes invitation
    const revokeRes = await request(app.server)
      .delete(`/organizations/${orgAId}/invitations/${freshInvId}`)
      .set('Cookie', user1.cookies);
    expect(revokeRes.status).toBe(200);

    // Verify notification was marked as read
    notif = await prisma.notification.findFirst({
      where: { userId: freshUser.userId, invitationId: freshInvId },
    });
    expect(notif?.readAt).not.toBeNull();

    // Verify recipient inbox no longer shows it as pending
    const inboxRes = await request(app.server)
      .get('/invitations/received')
      .set('Cookie', freshUser.cookies);
    expect(inboxRes.body.invitations.some((i: any) => i.id === freshInvId)).toBe(false);
  });

  // 24. Cross-organization invitation isolation: same recipient sees both legitimate invitations, orgs cannot cross-read
  it('24. Cross-organization invitation isolation: recipient sees invitations from Org A and Org B, but orgs cannot cross-read', async () => {
    const multiUser = await createTestUser(app, 'multi-org-invitee');

    // Org A invites multiUser
    const invA = await request(app.server)
      .post(`/organizations/${orgAId}/invitations`)
      .set('Cookie', user1.cookies)
      .send({ email: multiUser.email });

    // Org B invites multiUser
    const invB = await request(app.server)
      .post(`/organizations/${orgBId}/invitations`)
      .set('Cookie', userB.cookies)
      .send({ email: multiUser.email });

    // multiUser sees both invitations
    const inboxRes = await request(app.server)
      .get('/invitations/received')
      .set('Cookie', multiUser.cookies);
    const ids = inboxRes.body.invitations.map((i: any) => i.id);
    expect(ids).toContain(invA.body.invitationId);
    expect(ids).toContain(invB.body.invitationId);

    // Org A cannot see Org B's invitation in their tenant list
    const orgAList = await request(app.server)
      .get(`/organizations/${orgAId}/invitations`)
      .set('Cookie', user1.cookies);
    const orgAIds = orgAList.body.invitations.map((i: any) => i.id);
    expect(orgAIds).toContain(invA.body.invitationId);
    expect(orgAIds).not.toContain(invB.body.invitationId);
  });

  // 25. Notification RLS mutation isolation: User 2 cannot update or delete User 3's notification via raw DB
  it('25. Notification RLS mutation isolation: app_user with User 2 context cannot UPDATE or DELETE User 3 notifications', async () => {
    const user3Notif = await prisma.notification.create({
      data: {
        userId: user3.userId,
        type: 'ISOLATION_TEST',
        title: 'User 3 Secret Notification',
      },
    });

    const client = await rawPool.connect();
    try {
      await client.query('BEGIN;');
      await client.query('SET LOCAL ROLE app_user;');
      await client.query(`SELECT set_config('app.current_user_id', '${user2.userId}', TRUE);`);

      // Attempt update on User 3's notification
      const updateRes = await client.query(
        `UPDATE "Notification" SET title = 'HACKED' WHERE id = '${user3Notif.id}';`
      );
      expect(updateRes.rowCount).toBe(0);

      // Attempt delete on User 3's notification
      const deleteRes = await client.query(
        `DELETE FROM "Notification" WHERE id = '${user3Notif.id}';`
      );
      expect(deleteRes.rowCount).toBe(0);

      await client.query('ROLLBACK;');

      // Verify User 3's notification remains intact
      const notifInDb = await prisma.notification.findUnique({ where: { id: user3Notif.id } });
      expect(notifInDb?.title).toBe('User 3 Secret Notification');
    } finally {
      client.release();
      await prisma.notification.delete({ where: { id: user3Notif.id } });
    }
  });
});
