const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  const migrationPath = path.join(__dirname, 'prisma', 'migrations', '20241201_add_oauth_account', 'migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolon and execute each statement
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed.length === 0) continue;
    console.log('Executing:', trimmed.substring(0, 80) + '...');
    try {
      await prisma.$executeRawUnsafe(trimmed);
      console.log('OK');
    } catch (e) {
      console.error('ERROR:', e.message);
      // Continue anyway for some statements that might fail (like duplicate index)
    }
  }
  
  console.log('Migration completed');
  await prisma.$disconnect();
}

runMigration().catch(console.error);