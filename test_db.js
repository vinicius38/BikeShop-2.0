const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sales.findMany({ include: { SaleItems: true } });
  console.log("--- SALES ---");
  console.log(JSON.stringify(sales, null, 2));

  const wos = await prisma.workOrders.findMany();
  console.log("--- WORK ORDERS ---");
  console.log(JSON.stringify(wos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
