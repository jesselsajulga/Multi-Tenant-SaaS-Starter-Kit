import { buildApp } from '../src/app';
import request from 'supertest';
import { createTestUser, createTestOrg } from '../tests/test-utils';
import { prisma } from '../src/db';

async function runThreeUserE2E() {
  const app = buildApp();
  await app.ready();

  console.log('=== THREE-USER WORKSPACE DELETION & NOTIFICATION E2E VERIFICATION ===\n');

  // 1. Setup Three Users
  const user1 = await createTestUser(app, 'owner-user1');
  const user2 = await createTestUser(app, 'active-user2');
  const user3 = await createTestUser(app, 'offline-user3');

  console.log(`User 1 (Owner): ${user1.email}`);
  console.log(`User 2 (Active Member in /projects): ${user2.email}`);
  console.log(`User 3 (Offline Member): ${user3.email}`);

  // 2. User 1 creates Workspace "Alpha Team" and a Project "Secret Project"
  const orgRes = await createTestOrg(app, user1.cookies, 'Alpha Team');
  const orgId = orgRes.organization.id;
  console.log(`Created Workspace: "Alpha Team" (${orgId})`);

  const projRes = await prisma.project.create({
    data: {
      name: 'Secret Project',
      organizationId: orgId,
    },
  });
  console.log(`Created Project in "Alpha Team": "${projRes.name}" (${projRes.id})`);

  // 3. User 1 adds User 2 and User 3 as MEMBERS to "Alpha Team"
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: orgId, userId: user2.userId, role: 'MEMBER' },
      { organizationId: orgId, userId: user3.userId, role: 'MEMBER' },
    ],
  });
  console.log(`Added User 2 and User 3 as MEMBERS to "Alpha Team"\n`);

  // 4. Verify User 2 can read the project while workspace exists
  const user2ProjBefore = await request(app.server)
    .get('/projects')
    .set('Cookie', user2.cookies)
    .set('x-organization-id', orgId);
  console.log(`User 2 read /projects while workspace exists: ${user2ProjBefore.status} (expected 200)`);
  if (user2ProjBefore.status !== 200 || user2ProjBefore.body.projects.length === 0) {
    throw new Error('User 2 failed to access project before deletion');
  }

  // 5. User 1 (Owner) deletes Workspace "Alpha Team"
  console.log('\n--- User 1 (Owner) executes DELETE /organizations/:id ---');
  const deleteRes = await request(app.server)
    .delete(`/organizations/${orgId}`)
    .set('Cookie', user1.cookies);

  console.log(`Deletion response status: ${deleteRes.status} (expected 204)`);
  if (deleteRes.status !== 204) {
    throw new Error(`Expected 204 from workspace deletion, got ${deleteRes.status}`);
  }

  // 6. Verify Database Cascade: Workspace and Project permanently purged
  console.log('\n--- Verifying permanent database cascade ---');
  const checkOrg = await prisma.organization.findUnique({ where: { id: orgId } });
  const checkProj = await prisma.project.findUnique({ where: { id: projRes.id } });
  const checkMembers = await prisma.organizationMember.findMany({ where: { organizationId: orgId } });

  console.log(`Organization in DB: ${checkOrg ? 'STILL EXISTS (ERROR)' : 'PURGED (✓)'}`);
  console.log(`Project in DB: ${checkProj ? 'STILL EXISTS (ERROR)' : 'PURGED (✓)'}`);
  console.log(`Members in DB: ${checkMembers.length} (expected 0) (✓)`);

  if (checkOrg || checkProj || checkMembers.length > 0) {
    throw new Error('Database cascade failed to purge workspace and child resources');
  }

  // 7. Active Session Test: User 2 makes a request while sitting on /projects or /organizations/:id
  console.log('\n--- Active Session Fallback: User 2 requests deleted workspace resource ---');
  const user2ProjAfter = await request(app.server)
    .get('/projects')
    .set('Cookie', user2.cookies)
    .set('x-organization-id', orgId);

  console.log(`User 2 /projects status on deleted workspace: ${user2ProjAfter.status} (expected 404)`);
  console.log(`User 2 error code: ${user2ProjAfter.body.code} (expected "WORKSPACE_DELETED")`);

  if (user2ProjAfter.status !== 404 || user2ProjAfter.body.code !== 'WORKSPACE_DELETED') {
    throw new Error(`Expected 404 WORKSPACE_DELETED, got ${user2ProjAfter.status} with code ${user2ProjAfter.body.code}`);
  }

  const user2OrgAfter = await request(app.server)
    .get(`/organizations/${orgId}`)
    .set('Cookie', user2.cookies);

  console.log(`User 2 /organizations/:id status on deleted workspace: ${user2OrgAfter.status} (expected 404)`);
  console.log(`User 2 error code: ${user2OrgAfter.body.code} (expected "WORKSPACE_DELETED")`);

  if (user2OrgAfter.status !== 404 || user2OrgAfter.body.code !== 'WORKSPACE_DELETED') {
    throw new Error(`Expected 404 WORKSPACE_DELETED, got ${user2OrgAfter.status} with code ${user2OrgAfter.body.code}`);
  }

  // 8. Verify Notifications for User 2, User 3, and User 1
  console.log('\n--- Verifying Notification feeds across all three users ---');

  // User 2 notification feed
  const user2Notifs = await request(app.server)
    .get('/notifications')
    .set('Cookie', user2.cookies);

  const u2DeletedNotif = user2Notifs.body.notifications.find((n: any) => n.type === 'WORKSPACE_DELETED');
  console.log(`User 2 received WORKSPACE_DELETED notification: ${!!u2DeletedNotif} (expected true)`);
  if (u2DeletedNotif) {
    console.log(`  Title: "${u2DeletedNotif.title}"`);
    console.log(`  Message: "${u2DeletedNotif.message}"`);
  } else {
    throw new Error('User 2 did not receive WORKSPACE_DELETED notification');
  }

  // User 3 notification feed (offline member)
  const user3Notifs = await request(app.server)
    .get('/notifications')
    .set('Cookie', user3.cookies);

  const u3DeletedNotif = user3Notifs.body.notifications.find((n: any) => n.type === 'WORKSPACE_DELETED');
  console.log(`User 3 received WORKSPACE_DELETED notification: ${!!u3DeletedNotif} (expected true)`);
  if (u3DeletedNotif) {
    console.log(`  Title: "${u3DeletedNotif.title}"`);
    console.log(`  Message: "${u3DeletedNotif.message}"`);
  } else {
    throw new Error('User 3 did not receive WORKSPACE_DELETED notification');
  }

  // User 1 (Owner) - MUST NOT receive self-notification
  const user1Notifs = await request(app.server)
    .get('/notifications')
    .set('Cookie', user1.cookies);

  const u1DeletedNotif = user1Notifs.body.notifications.find((n: any) => n.type === 'WORKSPACE_DELETED');
  console.log(`User 1 (Owner) excluded from WORKSPACE_DELETED notifications: ${!u1DeletedNotif} (expected true)`);
  if (u1DeletedNotif) {
    throw new Error('Owner received an unwanted WORKSPACE_DELETED notification for their own action');
  }

  console.log('\n=== THREE-USER VERIFICATION COMPLETED SUCCESSFULLY ===');
  await app.close();
}

runThreeUserE2E()
  .catch((err) => {
    console.error('Three-user E2E verification failed:', err);
    process.exit(1);
  });
