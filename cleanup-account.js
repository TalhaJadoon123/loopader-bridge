const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanup() {
  // Delete the old trading account rows that were left in Account table
  // They have provider='credentials' and providerAccountId='unknown' 
  // since we copied them to TradingAccount already
  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM "Account" 
    WHERE "provider" = 'credentials' AND "providerAccountId" = 'unknown'
  `);
  console.log(`Deleted ${deleted} old trading account rows from Account table`);
  
  // Now create the unique index
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId")
  `);
  console.log('Created unique index on Account(provider, providerAccountId)');
  
  await prisma.$disconnect();
}

cleanup().catch(console.error);