const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const query = await prisma.$queryRaw`SELECT "Id", "StockQuantity", "MinimumStock" FROM "Products"`; 
  console.log('Products:', query); 
} 
main();
