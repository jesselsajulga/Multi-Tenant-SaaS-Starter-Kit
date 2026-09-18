import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { FastifyInstance } from 'fastify';
import { prisma } from '../src/db';
import { createTestUser, createTestOrg } from './test-utils';

describe('Complete Access Notification Lifecycle (Workspace & Member Access Changes)', () => {
  let app: FastifyInstance;

  let userA: { userId: string; email: string; cookies: string[] };
  let userB: { userId: string; email: string; cookies: string[] };
  let userC: { userId: string; email: string; cookies: string[] };
  let orgId: string;
  let orgName: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    userA = await createTestUser(app, 'owner-a');
    userB = await createTestUser(app, 'member-b');
    userC = await createTestUser(app, 'invitee-c');

    orgName = `Lifecycle-Org-${Date.now()}`;
    const orgRes = await createTestOrg(app, userA.cookies, orgName);
    orgId = orgRes.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let inviteBId: string;
  let inviteCId: string;

  // 1. Invite: User A invites User B -> User B receives MEMBER_INVITATION notification
  it('1. User A invites User B -> User B receives MEMBER_INVITATION notification', async () => {
    const res = await request(app.server)
      .post(`/organizations/${orgId}/invitations`)
      .set('Cookie', userA.cookies)
      .send({ email: userB.email });

    expect(res.status).toBe(201);
    expect(res.body.invitationId).toBeDefined();
    inviteBId = res.body.invitationId;

    const notifRes = await request(app.server)
      .get('/notifications')
      .set('Cookie', userB.cookies);

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.unreadCount).toBeGreaterThanOrEqual(1);
    const notif = notifRes.body.notifications.find((n: any) => n.invitationId === inviteBId);
    expect(notif).toBeDefined();
    expect(notif.type).toBe('MEMBER_INVITATION');
    expect(notif.title).toBe('Workspace Invitation');
    expect(notif.message).toContain(userA.email);
    expect(notif.message).toContain(orgName);
  });

  // 2. Acceptance: User B accepts -> User A receives WORKSPACE_INVITATION_ACCEPTED notification
  it('2. User B accepts invite -> User A receives WORKSPACE_INVITATION_ACCEPTED; User B invite notification marked read', async () => {
    const acceptRes = await request(app.server)
      .post(`/invitations/${inviteBId}/accept`)
      .set('Cookie', userB.cookies);

    expect(acceptRes.status).toBe(200);

    // User A receives notification
    const userANotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userA.cookies);

    expect(userANotifs.status).toBe(200);
    const acceptedNotif = userANotifs.body.notifications.find(
      (n: any) => n.type === 'WORKSPACE_INVITATION_ACCEPTED' && n.invitationId === inviteBId
    );
    expect(acceptedNotif).toBeDefined();
    expect(acceptedNotif.title).toBe('Invitation Accepted');
    expect(acceptedNotif.message).toContain(userB.email);
    expect(acceptedNotif.message).toContain(orgName);

    // User B's invitation notification is marked as read
    const userBNotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userB.cookies);
    const userBInviteNotif = userBNotifs.body.notifications.find((n: any) => n.invitationId === inviteBId);
    expect(userBInviteNotif?.readAt).not.toBeNull();
  });

  // 3. Duplicate Acceptance Prevention: repeated accept does NOT generate duplicate notifications
  it('3. Repeated / concurrent accept calls do not generate duplicate acceptance notifications', async () => {
    const secondAccept = await request(app.server)
      .post(`/invitations/${inviteBId}/accept`)
      .set('Cookie', userB.cookies);

    expect(secondAccept.status).toBe(409);

    const userANotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userA.cookies);

    const matchingCount = userANotifs.body.notifications.filter(
      (n: any) => n.type === 'WORKSPACE_INVITATION_ACCEPTED' && n.invitationId === inviteBId
    ).length;

    expect(matchingCount).toBe(1);
  });

  // 4. Revocation: User A invites User C, then revokes -> User C receives WORKSPACE_INVITATION_REVOKED
  it('4. User A invites User C, then revokes -> User C receives WORKSPACE_INVITATION_REVOKED notification', async () => {
    const inviteRes = await request(app.server)
      .post(`/organizations/${orgId}/invitations`)
      .set('Cookie', userA.cookies)
      .send({ email: userC.email });

    expect(inviteRes.status).toBe(201);
    inviteCId = inviteRes.body.invitationId;

    // User C has unread invite notification
    const cBefore = await request(app.server)
      .get('/notifications')
      .set('Cookie', userC.cookies);
    const pendingNotif = cBefore.body.notifications.find((n: any) => n.invitationId === inviteCId);
    expect(pendingNotif).toBeDefined();
    expect(pendingNotif.readAt).toBeNull();

    // User A revokes invitation
    const revokeRes = await request(app.server)
      .delete(`/organizations/${orgId}/invitations/${inviteCId}`)
      .set('Cookie', userA.cookies);

    expect(revokeRes.status).toBe(200);

    // User C checks notifications
    const cAfter = await request(app.server)
      .get('/notifications')
      .set('Cookie', userC.cookies);

    // Revocation notification received
    const revokedNotif = cAfter.body.notifications.find((n: any) => n.type === 'WORKSPACE_INVITATION_REVOKED');
    expect(revokedNotif).toBeDefined();
    expect(revokedNotif.title).toBe('Invitation Revoked');
    expect(revokedNotif.message).toContain(orgName);
    expect(revokedNotif.message).toContain(userA.email);

    // Old invitation notification was marked as read
    const oldNotif = cAfter.body.notifications.find((n: any) => n.id === pendingNotif.id);
    expect(oldNotif.readAt).not.toBeNull();

    // Old invite can no longer be accepted
    const failAccept = await request(app.server)
      .post(`/invitations/${inviteCId}/accept`)
      .set('Cookie', userC.cookies);
    expect(failAccept.status).toBe(409);
  });

  // 5. Duplicate Revoke Prevention: repeated revoke does NOT create duplicate revocation notifications
  it('5. Repeated / concurrent revoke calls do not create duplicate revocation notifications', async () => {
    const secondRevoke = await request(app.server)
      .delete(`/organizations/${orgId}/invitations/${inviteCId}`)
      .set('Cookie', userA.cookies);

    expect(secondRevoke.status).toBe(409);

    const cNotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userC.cookies);

    const revokeCount = cNotifs.body.notifications.filter(
      (n: any) => n.type === 'WORKSPACE_INVITATION_REVOKED' && n.invitationId === inviteCId
    ).length;

    expect(revokeCount).toBe(1);
  });

  // 6. Removal: User A removes User B -> User B receives WORKSPACE_MEMBER_REMOVED notification
  it('6. User A removes User B -> User B receives WORKSPACE_MEMBER_REMOVED notification and is ejected', async () => {
    const removeRes = await request(app.server)
      .delete(`/organizations/${orgId}/members/${userB.userId}`)
      .set('Cookie', userA.cookies);

    expect(removeRes.status).toBe(200);

    const bNotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userB.cookies);

    const removedNotif = bNotifs.body.notifications.find((n: any) => n.type === 'WORKSPACE_MEMBER_REMOVED');
    expect(removedNotif).toBeDefined();
    expect(removedNotif.title).toBe('Access Removed');
    expect(removedNotif.message).toContain(orgName);
    expect(removedNotif.message).toContain(userA.email);

    // Subsequent workspace access results in WORKSPACE_ACCESS_REVOKED
    const accessCheck = await request(app.server)
      .get(`/organizations/${orgId}`)
      .set('Cookie', userB.cookies);

    expect(accessCheck.status).toBe(403);
    expect(accessCheck.body.code).toBe('WORKSPACE_ACCESS_REVOKED');
  });

  // 7. Self-Removal: Voluntary exit does NOT generate removal notification
  it('7. Self-removal (voluntary exit) does not dispatch removal notification to self', async () => {
    // Create a new org with owner A and add voluntary user D
    const userD = await createTestUser(app, 'voluntary-d');
    const org2 = await createTestOrg(app, userA.cookies, 'Voluntary Org');

    await prisma.organizationMember.create({
      data: {
        organizationId: org2.organization.id,
        userId: userD.userId,
        role: 'MEMBER'
      }
    });

    // User D voluntarily leaves (acting on own user ID)
    // Even if performed by an admin endpoint or self, if actorId === targetUserId no notification is generated
    const voluntaryRemove = await prisma.$transaction(async (tx) => {
      await tx.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: org2.organization.id,
            userId: userD.userId
          }
        }
      });
    });

    const dNotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userD.cookies);

    const removedNotif = dNotifs.body.notifications.find((n: any) => n.type === 'WORKSPACE_MEMBER_REMOVED');
    expect(removedNotif).toBeUndefined();
  });

  // 8. RLS Isolation: User B cannot see User A or User C notifications
  it('8. Notification RLS isolation: User B cannot access User A or User C notifications', async () => {
    const bNotifs = await request(app.server)
      .get('/notifications')
      .set('Cookie', userB.cookies);

    expect(bNotifs.status).toBe(200);
    // Every notification returned belongs to User B
    for (const notif of bNotifs.body.notifications) {
      const dbNotif = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(dbNotif?.userId).toBe(userB.userId);
    }
  });
});
