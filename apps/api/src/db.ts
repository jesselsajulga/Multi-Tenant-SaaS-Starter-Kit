import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }) {
          return prisma.$transaction(async (tx) => {
            // Drop privileges for this transaction so RLS applies
            await tx.$executeRaw`SET LOCAL ROLE app_user;`;
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`;
            return (tx as any)[model][operation](args);
          });
        },
      },
    },
  });
}

export function getUserPrisma(userId: string, userEmail: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }) {
          return prisma.$transaction(async (tx) => {
            // Drop privileges for this transaction so RLS applies
            await tx.$executeRaw`SET LOCAL ROLE app_user;`;
            await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, TRUE);`;
            await tx.$executeRaw`SELECT set_config('app.current_user_email', ${userEmail}, TRUE);`;
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', TRUE);`;
            return (tx as any)[model][operation](args);
          });
        },
      },
    },
  });
}

