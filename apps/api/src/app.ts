import Fastify from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./auth/routes";

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

  app.register(authRoutes);

  return app;
}
