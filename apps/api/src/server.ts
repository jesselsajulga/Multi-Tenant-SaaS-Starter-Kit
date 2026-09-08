import "dotenv/config";
import { buildApp } from "./app";
import { prisma } from "./db";

const app = buildApp();

const start = async () => {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: 4000,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

// Graceful shutdown handling
const handleShutdown = async (signal: string) => {
  app.log.info(`Received ${signal}. Initiating graceful shutdown...`);
  try {
    await app.close();
    await prisma.$disconnect();
    app.log.info("Server and database connections closed cleanly.");
    process.exit(0);
  } catch (err) {
    app.log.error(err as any, "Error during graceful shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

start();

