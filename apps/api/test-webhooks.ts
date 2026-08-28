import { buildApp } from "./src/app";
import { prisma } from "./src/db";
import crypto from "crypto";

async function main() {
  const app = buildApp();
  await app.ready();

  const secret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_secret";
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  const testCustomerId = "cus_test_123";

  // Cleanup
  await prisma.stripeEvent.deleteMany({
    where: { id: { startsWith: "evt_test_" } }
  });
  await prisma.subscription.deleteMany({
    where: { stripeCustomerId: testCustomerId }
  });
  await prisma.organization.deleteMany({
    where: { name: "Billing Test Org" }
  });

  // Setup basic Organization & placeholder Subscription (simulating pre-checkout creation)
  const org = await prisma.organization.create({
    data: { name: "Billing Test Org" }
  });

  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      stripeCustomerId: testCustomerId,
    }
  });

  const sendWebhook = async (eventId: string, type: string, status: string, corruptSig: boolean = false) => {
    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      type,
      data: {
        object: {
          id: "sub_test_123",
          object: "subscription",
          customer: testCustomerId,
          status,
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days from now
          items: {
            data: [
              { price: { id: "price_pro" } }
            ]
          }
        }
      }
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac("sha256", secret).update(signaturePayload).digest("hex");
    const stripeSignatureHeader = `t=${timestamp},v1=${corruptSig ? "invalid" : signature}`;

    return app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      payload,
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignatureHeader
      }
    });
  };

  const checkSubState = async () => {
    const sub = await prisma.subscription.findUnique({ where: { stripeCustomerId: testCustomerId } });
    return sub;
  };

  console.log("--- Testing Subscription Sync Webhooks ---\n");

  // 1. Invalid signature
  const resInvalid = await sendWebhook("evt_test_inv", "customer.subscription.created", "active", true);
  console.log(`Invalid signature\tExpected: 400\tActual: ${resInvalid.statusCode}`);
  let sub = await checkSubState();
  console.log(`State unchanged\t\tExpected: null\tActual: ${sub?.status}`);

  // 2. Created
  const resCreated = await sendWebhook("evt_test_crt", "customer.subscription.created", "active");
  console.log(`\nCreated event\t\tExpected: 200\tActual: ${resCreated.statusCode}`);
  sub = await checkSubState();
  console.log(`Subscription status\tExpected: active\tActual: ${sub?.status}`);

  // 3. Duplicate created
  const resDup = await sendWebhook("evt_test_crt", "customer.subscription.created", "past_due"); // sending past_due to prove it ignores
  console.log(`\nDuplicate event\t\tExpected: 200\tActual: ${resDup.statusCode}`);
  sub = await checkSubState();
  console.log(`Subscription status\tExpected: active\tActual: ${sub?.status}`); // still active

  // 4. Updated
  const resUpdated = await sendWebhook("evt_test_upd", "customer.subscription.updated", "past_due");
  console.log(`\nUpdated event\t\tExpected: 200\tActual: ${resUpdated.statusCode}`);
  sub = await checkSubState();
  console.log(`Subscription status\tExpected: past_due\tActual: ${sub?.status}`);

  // 5. Deleted
  const resDeleted = await sendWebhook("evt_test_del", "customer.subscription.deleted", "canceled");
  console.log(`\nDeleted event\t\tExpected: 200\tActual: ${resDeleted.statusCode}`);
  sub = await checkSubState();
  console.log(`Subscription status\tExpected: canceled\tActual: ${sub?.status}`);

  // 6. Unknown event
  const resUnknown = await sendWebhook("evt_test_unk", "invoice.payment_failed", "active");
  console.log(`\nUnknown event\t\tExpected: 200\tActual: ${resUnknown.statusCode}`);
  sub = await checkSubState();
  console.log(`Subscription status\tExpected: canceled\tActual: ${sub?.status}`); // still canceled

  // Cleanup
  await prisma.stripeEvent.deleteMany({
    where: { id: { startsWith: "evt_test_" } }
  });
  await prisma.subscription.deleteMany({
    where: { stripeCustomerId: testCustomerId }
  });
  await prisma.organization.deleteMany({
    where: { id: org.id }
  });
  
  await app.close();
  await prisma.$disconnect();
}

main().catch(console.error);
