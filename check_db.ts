import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.users.findMany({ include: { Roles: true } });
  const roles = await prisma.roles.findMany();
  console.log('Users:', JSON.stringify(users, null, 2));
  console.log('Roles:', JSON.stringify(roles, null, 2));
}

main().finally(() => prisma.$disconnect());
