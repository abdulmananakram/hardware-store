import { readFileSync } from "node:fs";
import path from "node:path";

describe("offline shell service worker", () => {
  test("uses a versioned cache, precaches built Next assets, and cleans old caches", () => {
    const source = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
    expect(source).toContain("hardware-shop-shell-v2");
    expect(source).toContain("_next\\/static");
    expect(source).toContain("caches.delete");
    expect(source).toContain("NotoNaskhArabic.ttf");
  });
});
