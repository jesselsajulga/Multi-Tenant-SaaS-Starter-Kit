import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes } from "./auth/routes";
import { organizationRoutes } from "./organizations/routes";
import { projectRoutes } from "./projects/routes";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  app.register(cookie);

  app.register(authRoutes);
  app.register(organizationRoutes);
  app.register(projectRoutes);

  return app;
}
