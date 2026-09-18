import { buildApp } from '../src/app';
import request from 'supertest';
import { createTestUser, createTestOrg } from '../tests/test-utils';
import { prisma } from '../src/db';

async function runE2E() {
  const app = buildApp();
  await app.ready();

  console.log('=== WORKSPACE DELETION MULTI-ROLE E2E VERIFICATION ===');

  // 1. Setup: Owner creates Workspace A and Workspace B
  const owner = await createTestUser(app, 'e2e-owner');
  const user2 = await createTestUser(app, 'e2e-member');

  console.log(`Owner: ${owner.email}`);
  console.log(`User 2: ${user2.email}`);

  // Owner creates "Delete Test Workspace"
  const orgARes = await createTestOrg(app, owner.cookies, 'Delete Test Workspace');
  const orgAId = orgARes.organization.id;
  console.log(`Created Workspace A: "Delete Test Workspace" (${orgAId})`);

  // Owner creates "Delete Test Project" inside Workspace A
  const projRes = await prisma.project.create({
    data: {
      name: 'Delete Test Project',
      organizationId: orgAId,
    },
  });
  console.log(`Created Project in Workspace A: "${projRes.name}" (${projRes.id})`);

  // Owner creates a second workspace: "Surviving Workspace"
  const orgBRes = await createTestOrg(app, owner.cookies, 'Surviving Workspace');
  const orgBId = orgBRes.organization.id;
  console.log(`Created Workspace B (Surviving): "Surviving Workspace" (${orgBId})`);

  // Owner invites User 2 as a MEMBER to Workspace A
  await prisma.organizationMember.create({
    data: {
      organizationId: orgAId,
      userId: user2.userId,
      role: 'MEMBER',
    },
  });
  console.log(`Added User 2 as MEMBER to Workspace A`);

  // 2. Step 1: User 2 (MEMBER) attempts to delete Workspace A -> 403 Forbidden
  console.log('\n--- Step 1: MEMBER attempts deletion (must fail with 403) ---');
  const memberDeleteRes = await request(app.server)
    .delete(`/organizations/${orgAId}`)
    .set('Cookie', user2.cookies);

  console.log(`MEMBER delete status: ${memberDeleteRes.status} (expected 403)`);
  if (memberDeleteRes.status !== 403) {
    throw new Error(`Expected 403 for MEMBER deletion, got ${memberDeleteRes.status}`);
  }

  // Verify Workspace A and its project still exist
  const checkOrg1 = await prisma.organization.findUnique({ where: { id: orgAId } });
  const checkProj1 = await prisma.project.findUnique({ where: { id: projRes.id } });
  console.log(`Verification: Workspace A still in DB: ${checkOrg1 !== null}`);
  console.log(`Verification: Project still in DB: ${checkProj1 !== null}`);

  // 3. Step 2: Owner deletes Workspace A -> 204 No Content
  console.log('\n--- Step 2: OWNER deletes Workspace A (must succeed with 204) ---');
  const ownerDeleteRes = await request(app.server)
    .delete(`/organizations/${orgAId}`)
    .set('Cookie', owner.cookies);

  console.log(`OWNER delete status: ${ownerDeleteRes.status} (expected 204)`);
  if (ownerDeleteRes.status !== 204) {
    throw new Error(`Expected 204 for OWNER deletion, got ${ownerDeleteRes.status}`);
  }

  // 4. Step 3: Verify database cascade
  console.log('\n--- Step 3: Verifying database drops Workspace A and its project ---');
  const checkOrgAAfter = await prisma.organization.findUnique({ where: { id: orgAId } });
  const checkProjAfter = await prisma.project.findUnique({ where: { id: projRes.id } });
  const checkMembersAfter = await prisma.organizationMember.findMany({ where: { organizationId: orgAId } });

  console.log(`Workspace A in DB: ${checkOrgAAfter !== null ? 'EXISTS' : 'PURGED (✓)'}`);
  console.log(`Project in DB: ${checkProjAfter !== null ? 'EXISTS' : 'PURGED (✓)'}`);
  console.log(`Members in DB: ${checkMembersAfter.length} (expected 0)`);

  if (checkOrgAAfter !== null || checkProjAfter !== null || checkMembersAfter.length !== 0) {
    throw new Error('Database cascade check failed: records still exist!');
  }

  // 5. Step 4: Verify Surviving Workspace is unaffected
  console.log('\n--- Step 4: Verifying Surviving Workspace B is unaffected ---');
  const checkOrgBAfter = await prisma.organization.findUnique({ where: { id: orgBId } });
  console.log(`Workspace B in DB: ${checkOrgBAfter !== null ? 'INTACT (✓)' : 'MISSING'}`);
  if (!checkOrgBAfter) {
    throw new Error('Workspace B was unexpectedly modified or deleted!');
  }

  // 6. Step 5: Check remaining organizations query for Owner (switcher state)
  const remainingRes = await request(app.server)
    .get('/organizations')
    .set('Cookie', owner.cookies);

  const orgs = remainingRes.body.organizations.map((o: any) => o.organization.name);
  console.log(`Owner remaining workspaces in switcher: ${JSON.stringify(orgs)}`);
  const containsDeleted = remainingRes.body.organizations.some((o: any) => o.organization.id === orgAId);
  const containsSurviving = remainingRes.body.organizations.some((o: any) => o.organization.id === orgBId);

  console.log(`Switcher contains deleted Workspace A: ${containsDeleted} (expected false)`);
  console.log(`Switcher contains Surviving Workspace B: ${containsSurviving} (expected true)`);

  // 7. Step 6: Active session handling for User 2 (accessing deleted workspace returns 403/404)
  console.log('\n--- Step 6: Testing User 2 active session access on deleted workspace ---');
  const activeSessionRes = await request(app.server)
    .get(`/organizations/${orgAId}`)
    .set('Cookie', user2.cookies);

  console.log(`User 2 access to deleted workspace status: ${activeSessionRes.status} (expected 403 / revoked)`);

  await app.close();
  console.log('\n=== MULTI-ROLE E2E VERIFICATION COMPLETED SUCCESSFULLY ===');
}

runE2E().catch((err) => {
  console.error(err);
  process.exit(1);
});
