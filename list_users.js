const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.users.findMany().then(u => {
  console.log(JSON.stringify(u, null, 2));
  prisma.$disconnect();
});
