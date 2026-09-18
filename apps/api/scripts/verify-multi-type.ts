import { buildApp } from '../src/app';
import request from 'supertest';
import { createTestUser, createTestOrg } from '../tests/test-utils';

async function runVerification() {
  const app = buildApp();
  await app.ready();

  console.log('=== MULTI-TYPE VERIFICATION SCRIPT START ===');

  // 1. Create User A (Owner), User B (Target of events), User C (Invitee to revoke)
  const userA = await createTestUser(app, 'multitype-owner');
  const userB = await createTestUser(app, 'multitype-target');
  const userC = await createTestUser(app, 'multitype-revoke');

  console.log(`User A: ${userA.email}`);
  console.log(`User B: ${userB.email}`);
  console.log(`User C: ${userC.email}`);

  // Create Workspace 1 and Workspace 2
  const orgRes1 = await createTestOrg(app, userA.cookies, `Org-Main-${Date.now()}`);
  const org1Id = orgRes1.organization.id;

  const orgRes2 = await createTestOrg(app, userA.cookies, `Org-Second-${Date.now()}`);
  const org2Id = orgRes2.organization.id;

  // Event 1: User A invites User B to Workspace 1 (pending MEMBER_INVITATION)
  console.log('\n--- 1. Generating MEMBER_INVITATION for User B ---');
  const inviteBRes = await request(app.server)
    .post(`/organizations/${org1Id}/invitations`)
    .set('Cookie', userA.cookies)
    .send({ email: userB.email });
  console.log(`Invite B status: ${inviteBRes.status}, id: ${inviteBRes.body.invitationId}`);

  // Event 2: User A invites User B to Workspace 2, User B accepts, then User A removes User B
  console.log('\n--- 2. Generating WORKSPACE_MEMBER_REMOVED for User B ---');
  const inviteB2Res = await request(app.server)
    .post(`/organizations/${org2Id}/invitations`)
    .set('Cookie', userA.cookies)
    .send({ email: userB.email });
  await request(app.server)
    .post(`/invitations/${inviteB2Res.body.invitationId}/accept`)
    .set('Cookie', userB.cookies);
  const removeRes = await request(app.server)
    .delete(`/organizations/${org2Id}/members/${userB.userId}`)
    .set('Cookie', userA.cookies);
  console.log(`Remove B status: ${removeRes.status}`);

  // Event 3: User A invites User B to another workspace and revokes it
  console.log('\n--- 3. Generating WORKSPACE_INVITATION_REVOKED for User B ---');
  const orgRes3 = await createTestOrg(app, userA.cookies, `Org-Third-${Date.now()}`);
  const org3Id = orgRes3.organization.id;
  const inviteB3Res = await request(app.server)
    .post(`/organizations/${org3Id}/invitations`)
    .set('Cookie', userA.cookies)
    .send({ email: userB.email });
  const revokeRes = await request(app.server)
    .delete(`/organizations/${org3Id}/invitations/${inviteB3Res.body.invitationId}`)
    .set('Cookie', userA.cookies);
  console.log(`Revoke status: ${revokeRes.status}`);

  // Inspect User B's canonical feed from GET /notifications
  console.log('\n--- 4. Fetching User B GET /notifications feed ---');
  const notifRes = await request(app.server)
    .get('/notifications')
    .set('Cookie', userB.cookies);

  console.log(`Total notifications in feed: ${notifRes.body.notifications.length}`);
  console.log('Notification items in feed:');
  notifRes.body.notifications.forEach((n: any) => {
    console.log(` - ID: ${n.id} | Type: ${n.type} | Title: "${n.title}" | Read: ${!!n.readAt} | Has Invitation: ${!!n.invitation}`);
  });

  const hasInvite = notifRes.body.notifications.some((n: any) => n.type === 'MEMBER_INVITATION');
  const hasRemoved = notifRes.body.notifications.some((n: any) => n.type === 'WORKSPACE_MEMBER_REMOVED');
  const hasRevoked = notifRes.body.notifications.some((n: any) => n.type === 'WORKSPACE_INVITATION_REVOKED');

  console.log(`Feed contains MEMBER_INVITATION: ${hasInvite}`);
  console.log(`Feed contains WORKSPACE_MEMBER_REMOVED: ${hasRemoved}`);
  console.log(`Feed contains WORKSPACE_INVITATION_REVOKED: ${hasRevoked}`);

  const removedNotif = notifRes.body.notifications.find((n: any) => n.type === 'WORKSPACE_MEMBER_REMOVED');
  console.log(`Target for deep link: /notifications?notificationId=${removedNotif.id}`);

  await app.close();
  console.log('\n=== MULTI-TYPE VERIFICATION COMPLETED SUCCESSFULLY ===');
}

runVerification().catch(err => {
  console.error(err);
  process.exit(1);
});
