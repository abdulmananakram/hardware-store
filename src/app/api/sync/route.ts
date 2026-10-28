import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { createSale } from "@/server/services/salesService";
import { createPurchase } from "@/server/services/purchaseService";

const schema = z.object({
  sales: z.array(z.record(z.string(), z.unknown())).default([]),
  purchases: z.array(z.record(z.string(), z.unknown())).default([]),
});

export async function POST(request: NextRequest) {
  const token = process.env.SYNC_TOKEN;
  if (token && request.headers.get("x-sync-token") !== token) {
    return NextResponse.json({ error: true, message: "Invalid sync token" }, { status: 401 });
  }
  const authError = token ? null : requireAuth(request);
  if (authError) return authError;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: true, message: parsed.error.message }, { status: 400 });
  const results = { sales: [] as unknown[], purchases: [] as unknown[], errors: [] as string[] };
  for (const raw of parsed.data.sales) {
    try { results.sales.push(await createSale(raw as never)); } catch (error) { results.errors.push(error instanceof Error ? error.message : "Sale sync failed"); }
  }
  for (const raw of parsed.data.purchases) {
    try { results.purchases.push(await createPurchase(raw as never)); } catch (error) { results.errors.push(error instanceof Error ? error.message : "Purchase sync failed"); }
  }
  return NextResponse.json(results, { status: results.errors.length ? 207 : 200 });
}
