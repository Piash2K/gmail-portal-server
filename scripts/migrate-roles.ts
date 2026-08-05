// scripts/migrate-roles.ts
// One-time script: update stale PRIMARY_USER role values to USER in the database

import prisma from "../src/config/database";

async function main() {
  // Update any existing user rows that still have the old PRIMARY_USER enum value
  // This is needed because we renamed PRIMARY_USER -> USER in the schema
  const result = await prisma.$executeRaw`
    UPDATE users 
    SET role = 'USER'::"UserRole"
    WHERE role::text NOT IN ('USER', 'ADMIN')
  `;

  console.log(`Updated ${result} user(s) with stale role values.`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
