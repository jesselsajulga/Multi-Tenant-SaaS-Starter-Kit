import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes } from "./auth/routes";
import { organizationRoutes } from "./organizations/routes";
import { memberRoutes } from "./members/routes";
import { projectRoutes } from "./projects/routes";
import { webhookRoutes } from "./webhooks/routes";
import { billingRoutes } from "./billing/routes";
import { invitationRoutes } from "./invitations/routes";
import { auditRoutes } from "./audit/routes";
import { featureFlagsRoutes } from "./feature-flags/routes";
import { ssoRoutes } from "./auth/sso/routes";
import { notificationRoutes } from "./notifications/routes";

import rawBody from "fastify-raw-body";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  });

  // Centralized Error Sanitization
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;

    // Always log the full detailed error server-side
    app.log.error(error);

    // Client/validation errors (4xx): preserve informative message and status code
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: error?.message || "Bad Request",
      });
    }

    // Server errors (5xx): in production, sanitize to prevent database/driver/stack trace leakage
    if (process.env.NODE_ENV === "production") {
      return reply.status(500).send({
        error: "Internal Server Error",
      });
    }

    // In non-production environments, retain error message for debugging
    return reply.status(statusCode).send({
      error: error?.message || "Internal Server Error",
      statusCode,
    });
  });



  // Enable raw body for stripe webhook signatures
  app.register(rawBody, {
    field: "rawBody", 
    global: false, 
    encoding: "utf8", 
    runFirst: true 
  });

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  app.register(cookie);

  app.register(authRoutes);
  app.register(organizationRoutes);
  app.register(memberRoutes);
  app.register(projectRoutes);
  app.register(invitationRoutes);
  app.register(billingRoutes);
  app.register(webhookRoutes);
  app.register(auditRoutes);
  app.register(featureFlagsRoutes);
  app.register(ssoRoutes);
  app.register(notificationRoutes);

  return app;
}
