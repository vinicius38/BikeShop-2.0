const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const query = await prisma.$queryRaw`SELECT "Id" FROM "Products" WHERE "StockQuantity" <= "MinimumStock" AND "IsActive" = true LIMIT 1`; 
  console.log('Raw:', query); 
} 
main();
