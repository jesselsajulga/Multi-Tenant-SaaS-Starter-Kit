import { test } from "node:test";
import assert from "node:assert";
import { prisma } from "./src/db";
import { resolveIdentityToUser } from "./src/auth/sso/sso";
import { buildApp } from "./src/app";

test("SSO Foundation & Security Verification", async (t) => {
  const app = buildApp();
  await app.ready();

  const uniqueEmail = `sso-test-${Date.now()}@example.com`;

  await t.test("1. Reject Invalid State / CSRF Protection", async () => {
    // Attempt callback without a state cookie
    const response = await app.inject({
      method: "GET",
      url: "/auth/sso/google/callback?code=mock-code-123&state=fake-state",
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error, "Missing or expired SSO state");
  });

  await t.test("2. Resolve Identity: New SSO-Only User", async () => {
    const profile = {
      issuer: "https://accounts.google.com",
      subject: `mock-sub-${Date.now()}`,
      email: uniqueEmail,
      emailVerified: true
    };

    const user = await resolveIdentityToUser(profile, "google");

    assert.ok(user.id);
    assert.strictEqual(user.passwordHash, null, "SSO-only users must have null passwordHash");

    const identity = await prisma.identity.findFirst({
      where: { userId: user.id }
    });

    assert.ok(identity);
    assert.strictEqual(identity.issuer, profile.issuer);
    assert.strictEqual(identity.subject, profile.subject);
  });

  await t.test("3. Resolve Identity: Existing SSO User Logs In Again", async () => {
    const identityObj = await prisma.identity.findFirst({
      where: { user: { email: uniqueEmail } }
    });
    
    assert.ok(identityObj);

    const profile = {
      issuer: identityObj.issuer,
      subject: identityObj.subject,
      email: uniqueEmail,
      emailVerified: true
    };

    const user = await resolveIdentityToUser(profile, "google");
    assert.strictEqual(user.email, uniqueEmail, "Resolved to existing correct user");
  });

  await t.test("4. Account-Linking Protection (No Silent Linking)", async () => {
    // Attempt to log in with a new provider/subject but SAME email.
    const maliciousProfile = {
      issuer: "https://github.com",
      subject: `malicious-sub-${Date.now()}`,
      email: uniqueEmail,
      emailVerified: true
    };

    try {
      await resolveIdentityToUser(maliciousProfile, "github");
      assert.fail("Should have rejected silent linking");
    } catch (err: any) {
      assert.strictEqual(err.message, "ACCOUNT_EXISTS_REQUIRES_LINKING");
    }
  });

  await t.test("5. Hybrid User & Multiple Identities", async () => {
    const targetUser = await prisma.user.findUnique({
      where: { email: uniqueEmail }
    });

    assert.ok(targetUser);

    const newIdentity = await prisma.identity.create({
      data: {
        userId: targetUser.id,
        provider: "github",
        issuer: "https://github.com",
        subject: `legit-sub-${Date.now()}`
      }
    });

    assert.ok(newIdentity.id);
    
    const count = await prisma.identity.count({
      where: { userId: targetUser.id }
    });
    
    assert.strictEqual(count, 2, "User has exactly 2 linked identities");
  });
  
  await t.test("6. Duplicate Identity Rejection (Unique Constraint)", async () => {
    const existing = await prisma.identity.findFirst({
      where: { user: { email: uniqueEmail } }
    });
    assert.ok(existing);

    try {
      await prisma.identity.create({
        data: {
          userId: existing.userId,
          provider: "google",
          issuer: existing.issuer,
          subject: existing.subject
        }
      });
      assert.fail("Should have rejected duplicate issuer+subject constraint");
    } catch (err: any) {
      assert.ok(err.code === "P2002", "Unique constraint failed");
    }
  });

  // Cleanup
  await prisma.user.deleteMany({
    where: { email: uniqueEmail }
  });

  await app.close();
});
