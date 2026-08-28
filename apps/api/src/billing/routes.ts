import type { FastifyInstance } from "fastify";
import { authenticateRequest } from "../auth/authenticate";
import { authorizeOrganizationAccess } from "../auth/authorize";
import { checkoutSchema } from "./schema";
import { prisma } from "../db";
import { stripe } from "../stripe/client";

export async function billingRoutes(app: FastifyInstance) {
  app.post("/organizations/:organizationId/billing/checkout", async (request, reply) => {
    // 1. Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // 2. Authorize organization + role
    const { organizationId } = request.params as { organizationId: string };
    const authz = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (authz.error) {
      return reply.status(authz.status).send({ error: authz.error });
    }

    // 3. Validate plan
    const result = checkoutSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid request body", details: result.error });
    }
    const { plan } = result.data;

    // 4. Map plan to price ID
    let priceId: string;
    if (plan === "pro") {
      const proPrice = process.env.STRIPE_PRICE_PRO;
      if (!proPrice) {
        app.log.error("Missing STRIPE_PRICE_PRO environment variable");
        return reply.status(500).send({ error: "Internal Server Error" });
      }
      priceId = proPrice;
    } else {
      return reply.status(400).send({ error: "Unknown plan" });
    }

    // 5. Get or Create Stripe Customer
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId }
    });

    let customerId = subscription?.stripeCustomerId;

    if (!subscription || !customerId) {
      try {
        // Create new customer
        const customer = await stripe.customers.create({
          metadata: { organizationId }
        });
        customerId = customer.id;

        // Persist it without activating a subscription yet
        subscription = await prisma.subscription.create({
          data: {
            organizationId,
            stripeCustomerId: customerId
          }
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          // Re-fetch because it was created concurrently
          subscription = await prisma.subscription.findUnique({
            where: { organizationId }
          });
          if (subscription?.stripeCustomerId) {
             customerId = subscription.stripeCustomerId;
          } else {
             return reply.status(500).send({ error: "State error during checkout" });
          }
        } else {
          app.log.error(`Failed to create Stripe customer: ${err.message}`);
          return reply.status(500).send({ error: "Internal Server Error" });
        }
      }
    }

    // 6. Create Checkout Session
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          { price: priceId, quantity: 1 }
        ],
        mode: "subscription",
        success_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/billing?success=true` : "http://localhost:5173/billing?success=true",
        cancel_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/billing?canceled=true` : "http://localhost:5173/billing?canceled=true",
        client_reference_id: organizationId,
      });

      return reply.status(200).send({ url: session.url });
    } catch (err: any) {
      app.log.error(`Failed to create Stripe checkout session: ${err.message}`);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  app.post("/organizations/:organizationId/billing/portal", async (request, reply) => {
    // 1. Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    // 2. Authorize organization + role
    const { organizationId } = request.params as { organizationId: string };
    const authz = await authorizeOrganizationAccess(organizationId, auth.user.id, "OWNER");
    if (authz.error) {
      return reply.status(authz.status).send({ error: authz.error });
    }

    // 3. Look up existing Stripe Customer
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId }
    });

    const customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      return reply.status(400).send({ error: "No billing customer exists for this organization" });
    }

    // 4. Create Billing Portal Session
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/billing` : "http://localhost:5173/billing",
      });

      return reply.status(200).send({ url: session.url });
    } catch (err: any) {
      app.log.error(`Failed to create Stripe billing portal session: ${err.message}`);
      return reply.status(500).send({ error: "Internal Server Error" });
    }
  });
}
