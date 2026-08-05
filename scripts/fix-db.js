// scripts/fix-db.js — Fix stale PRIMARY_USER enum values in the DB
// Uses the same PrismaPg driver adapter as the main app

require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Running DB fixes...');

  // Update any users with stale PRIMARY_USER role to USER
  const rolesFixed = await prisma.$executeRawUnsafe(
    "UPDATE users SET role = 'USER' WHERE role::text NOT IN ('USER', 'ADMIN')"
  );
  console.log(`Fixed ${rolesFixed} user role(s).`);

  // Show current state
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true }
  });
  console.log('Current users:', users);

  const accounts = await prisma.gmailAccount.findMany({
    select: { id: true, email: true, accountType: true, userId: true }
  });
  console.log('Current accounts:', accounts);
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
