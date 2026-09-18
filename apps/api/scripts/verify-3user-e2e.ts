import { buildApp } from '../src/app';
import request from 'supertest';
import { createTestUser, createTestOrg } from '../tests/test-utils';

async function runScenario() {
  const app = buildApp();
  await app.ready();

  console.log('=== STARTING 3-USER MANUAL E2E SCENARIO ===');

  // Create User 1, User 2, User 3
  const user1 = await createTestUser(app, 'user1-e2e');
  const user2 = await createTestUser(app, 'user2-e2e');
  const user3 = await createTestUser(app, 'user3-e2e');

  console.log(`User 1: ${user1.email}`);
  console.log(`User 2: ${user2.email}`);
  console.log(`User 3: ${user3.email}`);

  // User 1 creates Workspace X
  const orgName = `Workspace-Alpha-${Date.now()}`;
  const orgRes = await createTestOrg(app, user1.cookies, orgName);
  const orgId = orgRes.organization.id;
  console.log(`Workspace created: ${orgName} (${orgId})`);

  // Step 1: User 1 invites User 2
  console.log('\n--- Step 1: User 1 invites User 2 ---');
  const invite2Res = await request(app.server)
    .post(`/organizations/${orgId}/invitations`)
    .set('Cookie', user1.cookies)
    .send({ email: user2.email });
  console.log(`Invite User 2 Status: ${invite2Res.status}, id: ${invite2Res.body.invitationId}`);

  // Check User 2 notification
  const u2Notifs1 = await request(app.server)
    .get('/notifications')
    .set('Cookie', user2.cookies);
  const u2InviteNotif = u2Notifs1.body.notifications.find((n: any) => n.invitationId === invite2Res.body.invitationId);
  console.log('User 2 Notification:', {
    type: u2InviteNotif?.type,
    title: u2InviteNotif?.title,
    message: u2InviteNotif?.message,
    readAt: u2InviteNotif?.readAt,
    actionable: true // links to /invitations
  });

  // Step 2: User 2 accepts invitation
  console.log('\n--- Step 2: User 2 accepts invitation ---');
  const accept2Res = await request(app.server)
    .post(`/invitations/${invite2Res.body.invitationId}/accept`)
    .set('Cookie', user2.cookies);
  console.log(`User 2 accept status: ${accept2Res.status}`);

  // Verify User 1 receives acceptance notification
  const u1Notifs1 = await request(app.server)
    .get('/notifications')
    .set('Cookie', user1.cookies);
  const u1AcceptNotif = u1Notifs1.body.notifications.find((n: any) => n.type === 'WORKSPACE_INVITATION_ACCEPTED');
  console.log('User 1 Notification:', {
    type: u1AcceptNotif?.type,
    title: u1AcceptNotif?.title,
    message: u1AcceptNotif?.message,
    readAt: u1AcceptNotif?.readAt,
    actionable: false
  });

  // Verify User 2's invite notification is now read
  const u2Notifs2 = await request(app.server)
    .get('/notifications')
    .set('Cookie', user2.cookies);
  const u2InviteNotifAfter = u2Notifs2.body.notifications.find((n: any) => n.invitationId === invite2Res.body.invitationId);
  console.log(`User 2 invite notification readAt: ${u2InviteNotifAfter?.readAt}`);

  // Step 3: User 1 invites User 3, then revokes
  console.log('\n--- Step 3: User 1 invites User 3, then revokes ---');
  const invite3Res = await request(app.server)
    .post(`/organizations/${orgId}/invitations`)
    .set('Cookie', user1.cookies)
    .send({ email: user3.email });
  const invite3Id = invite3Res.body.invitationId;
  console.log(`Invite User 3 Status: ${invite3Res.status}, id: ${invite3Id}`);

  // User 1 revokes invite
  const revokeRes = await request(app.server)
    .delete(`/organizations/${orgId}/invitations/${invite3Id}`)
    .set('Cookie', user1.cookies);
  console.log(`Revoke status: ${revokeRes.status}`);

  // User 3 notifications
  const u3Notifs = await request(app.server)
    .get('/notifications')
    .set('Cookie', user3.cookies);
  const u3RevokedNotif = u3Notifs.body.notifications.find((n: any) => n.type === 'WORKSPACE_INVITATION_REVOKED');
  const u3OriginalInvite = u3Notifs.body.notifications.find((n: any) => n.invitationId === invite3Id && n.type === 'MEMBER_INVITATION');
  console.log('User 3 Revocation Notification:', {
    type: u3RevokedNotif?.type,
    title: u3RevokedNotif?.title,
    message: u3RevokedNotif?.message,
    actionable: false
  });
  console.log(`User 3 original invite marked read: ${u3OriginalInvite?.readAt !== null}`);

  // User 3 attempts to accept old revoked invite
  const u3AcceptStale = await request(app.server)
    .post(`/invitations/${invite3Id}/accept`)
    .set('Cookie', user3.cookies);
  console.log(`User 3 attempt to accept revoked invite status: ${u3AcceptStale.status} (${u3AcceptStale.body.error})`);

  // Step 4: User 1 removes User 2
  console.log('\n--- Step 4: User 1 removes User 2 ---');
  const removeRes = await request(app.server)
    .delete(`/organizations/${orgId}/members/${user2.userId}`)
    .set('Cookie', user1.cookies);
  console.log(`Remove User 2 status: ${removeRes.status}`);

  // User 2 notifications
  const u2Notifs3 = await request(app.server)
    .get('/notifications')
    .set('Cookie', user2.cookies);
  const u2RemoveNotif = u2Notifs3.body.notifications.find((n: any) => n.type === 'WORKSPACE_MEMBER_REMOVED');
  console.log('User 2 Removal Notification:', {
    type: u2RemoveNotif?.type,
    title: u2RemoveNotif?.title,
    message: u2RemoveNotif?.message,
    actionable: false
  });

  // User 2 attempts workspace access -> 403 access revoked (ejection trigger)
  const u2AccessRes = await request(app.server)
    .get(`/organizations/${orgId}`)
    .set('Cookie', user2.cookies);
  console.log(`User 2 access post-removal status: ${u2AccessRes.status} (code: ${u2AccessRes.body.code})`);

  await app.close();
  console.log('\n=== SCENARIO COMPLETED SUCCESSFULLY ===');
}

runScenario().catch(err => {
  console.error(err);
  process.exit(1);
});
