const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user.update({
  where: { email: 'test1373639139@example.com' },
  data: { emailVerified: true }
}).then(u => {
  console.log('Updated:', u.email);
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});