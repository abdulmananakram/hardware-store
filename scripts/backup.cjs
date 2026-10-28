/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const root = path.resolve(__dirname, "..");
const source = path.resolve(root, "db", "custom.db");
const backupDir = path.resolve(root, "backups");
const now = new Date();
const pad = (value) => String(value).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const destination = path.join(backupDir, `custom-${stamp}.db`);

async function main() {
  if (!fs.existsSync(source)) throw new Error(`Database not found: ${source}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const prisma = new PrismaClient();
  try {
    const escaped = destination.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
  } finally {
    await prisma.$disconnect();
  }
  const backups = fs.readdirSync(backupDir)
    .filter((name) => /^custom-.*\.db$/.test(name))
    .sort()
    .reverse();
  for (const old of backups.slice(30)) fs.rmSync(path.join(backupDir, old));
  console.log(`Created ${destination}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
