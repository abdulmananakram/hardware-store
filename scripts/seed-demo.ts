import "fake-indexeddb/auto";
import { localDb } from "../src/lib/localDb";
import { assertDemoExpected, seedDemoData } from "../src/lib/demoSeed";

async function main(): Promise<void> {
  await localDb.open();
  await seedDemoData();
  await assertDemoExpected();
  console.log("Demo data seeded and expected results verified.");
  await localDb.close();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
