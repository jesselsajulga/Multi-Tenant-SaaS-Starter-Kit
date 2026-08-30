import { prisma } from './src/db';

async function main() {
  await prisma.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO app_user;');
  await prisma.$executeRawUnsafe('GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;');
  await prisma.$executeRawUnsafe('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;');
  console.log('Granted');
}
main().catch(console.error);
