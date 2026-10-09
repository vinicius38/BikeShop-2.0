import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const wos = await prisma.workOrders.groupBy({
    by: ['Status'],
    _count: true
  });
  console.log('WorkOrders:', wos);

  const sales = await prisma.sales.groupBy({
    by: ['Status'],
    _count: true
  });
  console.log('Sales:', sales);

  const products = await prisma.products.findMany({ take: 1 });
  console.log('Product sample:', products);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
