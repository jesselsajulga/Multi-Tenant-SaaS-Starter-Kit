import type { FastifyInstance } from "fastify";
import { stripe, getStripeWebhookSecret } from "../stripe/client";
import { prisma } from "../db";

export async function webhookRoutes(app: FastifyInstance) {
  // Use config to enable raw body specifically for this route
  app.post("/webhooks/stripe", { config: { rawBody: true } }, async (request, reply) => {
    const signature = request.headers["stripe-signature"];

    if (!signature) {
      return reply.status(400).send({ error: "Missing stripe-signature header" });
    }

    const rawBody = (request as any).rawBody;

    if (!rawBody) {
      return reply.status(400).send({ error: "Missing raw body" });
    }

    const webhookSecret = getStripeWebhookSecret();

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (err: any) {
      // Signature verification failed
      app.log.error(`Webhook signature verification failed: ${err.message}`);
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    // Successfully verified!
    app.log.info(`Received verified Stripe webhook event: ${event.type} [${event.id}]`);

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Idempotency Check
        await tx.stripeEvent.create({
          data: {
            id: event.id,
            type: event.type,
          },
        });

        // 2. Subscription Synchronization
        if (
          event.type === "customer.subscription.created" ||
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          const subscription = event.data.object as any;
          const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

          // Look up by Stripe Customer ID
          const existingSub = await tx.subscription.findUnique({
            where: { stripeCustomerId: customerId },
          });

          if (existingSub) {
            await tx.subscription.update({
              where: { id: existingSub.id },
              data: {
                stripeSubscriptionId: subscription.id,
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                // Extract price ID from the first subscription item
                plan: subscription.items?.data?.[0]?.price?.id || null,
              },
            });
            app.log.info(`Synchronized subscription for customer ${customerId}`);
          } else {
            app.log.warn(`No local subscription found for Stripe customer ${customerId}`);
          }
        }
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        app.log.info(`Stripe webhook event ${event.id} already processed`);
        return reply.status(200).send({ received: true, duplicate: true });
      }
      // Rethrow other database errors
      app.log.error(`Database error processing webhook: ${err.message}`);
      return reply.status(500).send({ error: "Internal Server Error" });
    }

    return reply.status(200).send({ received: true });
  });
}
