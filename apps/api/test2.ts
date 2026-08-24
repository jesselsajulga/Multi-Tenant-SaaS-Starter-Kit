import { getTenantPrisma, prisma } from "./src/db";
async function main() {
  const t = getTenantPrisma('test-id');
  const result = await prisma.$queryRaw`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'Project'`;
  console.log("pg_class:", result);
}
main().finally(() => prisma.$disconnect());
