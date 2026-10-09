const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT "Id", "StockQuantity", "MinimumStock" FROM "Products" WHERE "StockQuantity" <= "MinimumStock" AND "IsActive" = true`
  .then(console.log);
