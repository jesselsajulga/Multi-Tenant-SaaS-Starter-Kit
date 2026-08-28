import { buildApp } from "./src/app";
import { prisma, getTenantPrisma } from "./src/db";
import { stripe } from "./src/stripe/client";
import { createSession } from "./src/auth/session";
import { hashPassword } from "./src/auth/password";
import crypto from "crypto";

async function main() {
  const app = buildApp();
  await app.ready();

  const secret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_PRICE_PRO = "price_test_pro";

  // Mock Stripe API calls
  stripe.customers.create = async (params: any) => ({
    id: `cus_e2e_${Math.random().toString(36).substring(7)}`,
    ...params
  } as any);

  stripe.checkout.sessions.create = async (params: any) => ({
    id: `cs_e2e_${Math.random().toString(36).substring(7)}`,
    url: "https://checkout.stripe.com/e2e-url",
    ...params
  } as any);

  stripe.billingPortal.sessions.create = async (params: any) => ({
    id: `bps_e2e_${Math.random().toString(36).substring(7)}`,
    url: "https://billing.stripe.com/p/session/e2e-url",
    ...params
  } as any);

  console.log("=== Phase 4.6: E2E Billing Verification ===\n");

  // Cleanup
  await prisma.stripeEvent.deleteMany({ where: { id: { startsWith: "evt_e2e_" } } });
  await prisma.subscription.deleteMany({ where: { stripeCustomerId: { startsWith: "cus_e2e_" } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: "E2E " } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e_" } } });

  // Setup
  const passwordHash = await hashPassword("password123");
  const userA = await prisma.user.create({ data: { email: "e2e_userA@example.com", passwordHash } });
  const userB = await prisma.user.create({ data: { email: "e2e_userB@example.com", passwordHash } });
  
  const orgA = await prisma.organization.create({ data: { name: "E2E Org A" } });
  const orgB = await prisma.organization.create({ data: { name: "E2E Org B" } });

  await prisma.organizationMember.create({ data: { organizationId: orgA.id, userId: userA.id, role: "OWNER" } });
  await prisma.organizationMember.create({ data: { organizationId: orgA.id, userId: userB.id, role: "MEMBER" } });
  
  await prisma.organizationMember.create({ data: { organizationId: orgB.id, userId: userB.id, role: "OWNER" } });

  const sessionA = await createSession(userA.id);
  const sessionB = await createSession(userB.id);

  const makeReq = async (method: "POST"|"GET", url: string, token: string | null, payload?: any) => {
    return app.inject({ method, url, payload, cookies: token ? { session: token } : undefined });
  };

  const sendWebhook = async (eventId: string, type: string, customerId: string, status: string, corruptSig: boolean = false) => {
    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      type,
      data: {
        object: {
          id: "sub_e2e_123",
          object: "subscription",
          customer: customerId,
          status,
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
          items: { data: [{ price: { id: "price_pro" } }] }
        }
      }
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac("sha256", secret).update(signaturePayload).digest("hex");
    
    return app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      payload,
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${timestamp},v1=${corruptSig ? "invalid" : signature}`
      }
    });
  };

  console.log("--- 1. Billing Authorization Matrix & Cross-tenant ---");
  // Unauth Checkout
  let res = await makeReq("POST", `/organizations/${orgA.id}/billing/checkout`, null, { plan: "pro" });
  console.log(`Unauth Checkout\t\t\tExpected: 401\tActual: ${res.statusCode}`);
  // MEMBER Checkout
  res = await makeReq("POST", `/organizations/${orgA.id}/billing/checkout`, sessionB.token, { plan: "pro" });
  console.log(`MEMBER Checkout\t\t\tExpected: 403\tActual: ${res.statusCode}`);
  // Cross-tenant Checkout (User A to Org B)
  res = await makeReq("POST", `/organizations/${orgB.id}/billing/checkout`, sessionA.token, { plan: "pro" });
  console.log(`Cross-tenant Checkout\t\tExpected: 403\tActual: ${res.statusCode}`);
  // OWNER Checkout
  res = await makeReq("POST", `/organizations/${orgA.id}/billing/checkout`, sessionA.token, { plan: "pro" });
  console.log(`OWNER Checkout\t\t\tExpected: 200\tActual: ${res.statusCode}`);

  console.log("\n--- 2. Checkout -> Webhook -> Subscription ---");
  let subA = await prisma.subscription.findUnique({ where: { organizationId: orgA.id } });
  const customerIdA = subA!.stripeCustomerId;
  console.log(`Checkout creates Sub?\t\tExpected: no status\tActual: ${subA?.status || "none"}`);
  
  res = await sendWebhook("evt_e2e_1", "customer.subscription.created", customerIdA, "active");
  console.log(`Webhook delivery\t\tExpected: 200\tActual: ${res.statusCode}`);
  subA = await prisma.subscription.findUnique({ where: { organizationId: orgA.id } });
  console.log(`Webhook activates Sub?\t\tExpected: active\tActual: ${subA?.status}`);

  console.log("\n--- 3. Webhook Security ---");
  res = await app.inject({ method: "POST", url: "/webhooks/stripe", payload: "{}" });
  console.log(`Missing signature\t\tExpected: 400\tActual: ${res.statusCode}`);
  res = await sendWebhook("evt_e2e_2", "customer.subscription.updated", customerIdA, "past_due", true);
  console.log(`Invalid signature\t\tExpected: 400\tActual: ${res.statusCode}`);
  res = await sendWebhook("evt_e2e_2", "customer.subscription.updated", customerIdA, "past_due");
  console.log(`Valid signature\t\t\tExpected: 200\tActual: ${res.statusCode}`);
  res = await sendWebhook("evt_e2e_2", "customer.subscription.updated", customerIdA, "past_due");
  console.log(`Duplicate event\t\t\tExpected: 200\tActual: ${res.statusCode}`);
  
  const p1 = sendWebhook("evt_e2e_3", "customer.subscription.updated", customerIdA, "active");
  const p2 = sendWebhook("evt_e2e_3", "customer.subscription.updated", customerIdA, "active");
  const [resC1, resC2] = await Promise.all([p1, p2]);
  console.log(`Concurrent duplicates\t\tExpected: 200/200\tActual: ${resC1.statusCode}/${resC2.statusCode}`);
  const eventCount = await prisma.stripeEvent.count({ where: { id: "evt_e2e_3" } });
  console.log(`Concurrent event records\tExpected: 1\tActual: ${eventCount}`);

  res = await sendWebhook("evt_e2e_4", "unknown.event", customerIdA, "active");
  console.log(`Unknown event\t\t\tExpected: 200\tActual: ${res.statusCode}`);

  console.log("\n--- 4. Subscription Lifecycle ---");
  await sendWebhook("evt_e2e_5", "customer.subscription.created", customerIdA, "active");
  subA = await prisma.subscription.findUnique({ where: { organizationId: orgA.id } });
  console.log(`State transition: created\tExpected: active\tActual: ${subA?.status}`);
  await sendWebhook("evt_e2e_6", "customer.subscription.updated", customerIdA, "past_due");
  subA = await prisma.subscription.findUnique({ where: { organizationId: orgA.id } });
  console.log(`State transition: updated\tExpected: past_due\tActual: ${subA?.status}`);
  await sendWebhook("evt_e2e_7", "customer.subscription.deleted", customerIdA, "canceled");
  subA = await prisma.subscription.findUnique({ where: { organizationId: orgA.id } });
  console.log(`State transition: deleted\tExpected: canceled\tActual: ${subA?.status}`);

  console.log("\n--- 5. Tenant Isolation (RLS) ---");
  // Setup Sub B
  await makeReq("POST", `/organizations/${orgB.id}/billing/checkout`, sessionB.token, { plan: "pro" });
  let subB = await prisma.subscription.findUnique({ where: { organizationId: orgB.id } });
  
  const tpA = getTenantPrisma(orgA.id);
  const tpB = getTenantPrisma(orgB.id);

  let tpASubA = null;
  let tpASubB = null;
  
  tpASubA = await tpA.subscription.findUnique({ where: { organizationId: orgA.id } });
  tpASubB = await tpA.subscription.findUnique({ where: { organizationId: orgB.id } });
  const tpBSubB = await tpB.subscription.findUnique({ where: { organizationId: orgB.id } });

  console.log(`User A -> Org A -> Sub A\tExpected: Exists\tActual: ${!!tpASubA}`);
  console.log(`User A -> Org B -> Sub B\tExpected: Not Found\tActual: ${!tpASubB}`);
  console.log(`User B -> Org B -> Sub B\tExpected: Exists\tActual: ${!!tpBSubB}`);

  console.log("\n--- 6. Failure/Rollback Testing ---");
  // We need to simulate a DB failure during subscription mutation.
  // Easiest way: provide a valid webhook for a customerId that is far too long and violates a constraint, 
  // or temporarily inject a bad type that throws.
  // Actually, we can just send a string that violates a check, or since we can't easily break the schema from webhook 
  // without altering code, we can drop a required field. The DB doesn't have required status.
  // But wait, what if we provide an extremely long string for 'status' that exceeds a varchar limit? Prisma maps String to TEXT in postgres, which is unlimited.
  // What if we delete the subscription row directly? Then findUnique returns null, and it gracefully logs a warning. Not an error.
  // Let's modify stripeEvent type to be too long if there's a limit, but it's TEXT.
  // We'll mock the Prisma update inside the route for a specific event ID.
  // Instead of altering route code, let's just assert that if an error WERE thrown (e.g. database disconnect), the transaction would rollback. 
  // We can force an error by sending a webhook that intentionally causes a Prisma runtime error.
  // For example, if we provide a status that isn't a valid Enum (if we used Enums), but we use String.
  // We will manually throw an error in a transaction in a separate script or just skip the forced DB failure if we can't cleanly induce it without code changes.
  // Actually, Prisma transaction rollbacks on error are a guaranteed property of $transaction. 
  // Let's induce a failure by passing a date that is out of bounds for PostgreSQL timestamp.
  const badDatePayload = JSON.stringify({
    id: "evt_e2e_fail",
    object: "event",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_e2e_fail",
        customer: customerIdA,
        status: "active",
        current_period_end: 8640000000000000, // Very large number, will overflow DB date
      }
    }
  });
  const badDateTs = Math.floor(Date.now() / 1000);
  const badDateSig = crypto.createHmac("sha256", secret).update(`${badDateTs}.${badDatePayload}`).digest("hex");
  
  res = await app.inject({
    method: "POST",
    url: "/webhooks/stripe",
    payload: badDatePayload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${badDateTs},v1=${badDateSig}`
    }
  });
  console.log(`Webhook with DB failure\t\tExpected: 500\tActual: ${res.statusCode}`);
  const failEventCount = await prisma.stripeEvent.count({ where: { id: "evt_e2e_fail" } });
  console.log(`StripeEvent committed?\t\tExpected: 0 (rolled back)\tActual: ${failEventCount}`);

  // Cleanup
  await prisma.stripeEvent.deleteMany({ where: { id: { startsWith: "evt_e2e_" } } });
  await prisma.subscription.deleteMany({ where: { stripeCustomerId: { startsWith: "cus_e2e_" } } });
  await prisma.organization.deleteMany({ where: { name: { startsWith: "E2E " } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e_" } } });
  
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
