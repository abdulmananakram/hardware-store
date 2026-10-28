/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.shopConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { shopId: 1 },
  });
  console.log("Created the default shop configuration. Add inventory from the POS.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
