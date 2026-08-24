import { PrismaClient } from "./src/generated/prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function run() {
  const user = await prisma.user.findUnique({ where: { email: "user@example.com" }});
  console.log(JSON.stringify(user, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
